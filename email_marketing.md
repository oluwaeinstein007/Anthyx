# Email Marketing — Architecture & Roadmap

## What's Built Now (Phase 1)

Email works as a **platform** in the same pipeline as Twitter, LinkedIn etc. — the AI agent generates content, it gets scheduled via BullMQ, and the worker sends it.

| Capability | Status |
|---|---|
| Connect SMTP account (Gmail, Outlook, Mailgun SMTP, etc.) | ✅ |
| Connect SendGrid (API key) | ✅ |
| Connect Mailgun (API key + domain) | ✅ |
| Per-recipient sends (no address leakage) | ✅ |
| Subject parsed from first line of AI content | ✅ |
| HTML body | ✅ |
| Stored recipient list per connected account | ✅ |
| Token/credential encryption at rest | ✅ |

**Limitation:** The recipient list is static — set at connection time, stored in `platformConfig.recipients`. There is no list management, no unsubscribe handling, no tracking.

---

## What's Needed for Proper Email Marketing

### 1. List Management
The current model is a flat array of emails in `platformConfig`. This doesn't scale.

**Recommendation:** Add a `email_lists` table:
```
email_lists
  id, organizationId, socialAccountId, name, description, createdAt

email_list_contacts
  id, listId, email, firstName, lastName, tags[], subscribedAt, unsubscribedAt, status (subscribed/unsubscribed/bounced/complained)
```

Why: unsubscribes need to be stored persistently, not just removed from an array. Bounces and complaints must be suppressed automatically to protect sender reputation.

### 2. Unsubscribe Links (Legal Requirement — CAN-SPAM / GDPR)
Every marketing email **must** include an unsubscribe link. This is not optional.

**What's needed:**
- A signed unsubscribe URL: `GET /email/unsubscribe?token=<jwt>&listId=<id>`
- The token encodes `contactId` + `listId` (signed with JWT_SECRET)
- On click: mark contact as `unsubscribed`, return a confirmation page
- Automatic suppression: never send to unsubscribed contacts
- The email publishing function must inject this link into every HTML body before sending

### 3. Bounce + Complaint Handling
Sending to bounced or complained addresses damages sender reputation and can get your account banned.

**What's needed:**
- **SendGrid**: Webhook for `bounce`, `spamreport`, `unsubscribe` events → mark contact in DB
- **Mailgun**: Webhook for `bounced`, `complained`, `unsubscribed` events → same
- **SMTP**: No automatic bounce handling — need to monitor the reply-to address or use a service like Postmark for bounce webhooks

**Recommendation:** Add a webhook endpoint `POST /email/webhooks/:provider` that processes these events and updates `email_list_contacts.status`.

### 4. Open & Click Tracking
**What's needed:**
- Open tracking: inject a 1x1 tracking pixel `<img src="/email/track/open?token=...">` into HTML body
- Click tracking: rewrite all `<a href>` links to go through `GET /email/track/click?token=...&url=<encoded>`
- Store events in a `email_events` table: `(postId, contactId, type, timestamp)`
- Surface in analytics dashboard

**Recommendation:** Do open/click tracking only for SendGrid/Mailgun — use their built-in tracking features (just enable it in the API payload). For SMTP, implement the pixel/redirect approach manually.

### 5. Templates
The current system relies on the AI generating raw HTML. This is fragile for email (email clients are not browsers — tables, inline styles, limited CSS).

**What's needed:**
- A library of responsive email templates (use [MJML](https://mjml.io/) or [React Email](https://react.email/))
- Templates stored per organization in a `email_templates` table
- The AI generates content data (headline, body, CTA text, CTA URL), which gets injected into a template
- Compiled to HTML at send time

**Recommendation:** Start with React Email. 5–6 templates (newsletter, product update, announcement, digest, promotional, re-engagement) covers 90% of use cases.

### 6. Campaign Management
Currently posts are one-off sends. Email marketing needs campaigns — a series of sends to a list over time.

**What's needed:**
- A `email_campaigns` table: `(id, orgId, listId, templateId, subject, scheduledAt, sentAt, status, stats)`
- Campaign builder UI: select list → select/create template → set subject → schedule
- The agent can propose campaign content; a human approves before send
- Stats rollup: total sent, opens, clicks, unsubscribes, bounces, conversion rate

### 7. Segmentation
Being able to send to "contacts tagged with X" or "contacts who opened the last email" dramatically improves engagement.

**What's needed:**
- Tags on `email_list_contacts`
- A simple segment query builder (include/exclude by tag, engagement status, join date)
- Pass segment ID instead of list ID when scheduling

---

## Bulk Send Recommendation

**Current (Phase 1):** The system sends individual API calls per recipient. This is correct for up to ~500 recipients. Beyond that:

| Volume | Recommendation |
|---|---|
| < 500/campaign | Current per-recipient sends — fine |
| 500 – 50K/campaign | **SendGrid**: use `personalizations` array (up to 1,000 per API call, batch them). **Mailgun**: use batch sends with `recipient-variables`. **SMTP**: use a queue with concurrency limiting (10–20 concurrent connections max) |
| > 50K/campaign | Dedicated ESP with dedicated IP: SendGrid Marketing Campaigns, Mailgun with dedicated IP, or Amazon SES |

**For SMTP at scale:** SMTP is inherently serial and slow. Gmail/Outlook cap sending rate. SMTP is fine for low-volume transactional-style campaigns (< 200/day on Gmail, higher on business SMTP). For volume, switch to SendGrid or Mailgun API mode.

---

## Provider Recommendation

| Use Case | Provider | Why |
|---|---|---|
| Getting started, low volume | **SMTP** (Gmail App Password) | Zero cost, zero setup beyond App Password |
| Growth-stage, marketing focus | **SendGrid** | Best deliverability tooling, free tier (100/day), easy API |
| Technical teams, EU data residency | **Mailgun** | EU region support, good logs, pay-as-you-go |
| High volume, already on AWS | **Amazon SES** | Not yet in Anthyx — cheapest at scale ($0.10/1K emails) |

**Resend** (already in `.env` for transactional email) is an option for marketing too — its API is the cleanest of any provider. Worth adding as a 4th option in a future iteration.

---

## Recommended Build Order

```
Phase 1 (done)   — Connect accounts, send to static recipient list
Phase 2 (next)   — email_lists table, contact management, unsubscribe link injection, bounce/complaint webhooks
Phase 3           — Open/click tracking, React Email templates, campaign manager UI
Phase 4           — Segmentation, A/B testing, send-time optimization, SES support
```

Phase 2 is the minimum needed before using this for real marketing. Without unsubscribe links and bounce handling, bulk sends risk legal issues and account bans.
