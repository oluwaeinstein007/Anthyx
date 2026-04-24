# Anthyx — Improvement & Roadmap

> Status as of April 2026. Covers what needs to be built, updated, or fixed across the full stack.

---

## 1. Admin Dashboard — `admin/` (NEW APP)

A separate Next.js app at `admin/` (monorepo root, alongside `frontend/` and `api/`). Each top-level app is a standalone deployable unit — flat structure makes future repo separation straightforward. Completely isolated from the user-facing frontend. Protected by a separate `ADMIN_SECRET` or an `is_super_admin` flag on the users table.

### Pages to build

| Page | Purpose |
|---|---|
| `/dashboard` | Platform overview: total orgs, MRR, posts published today, queue depths |
| `/organizations` | List all orgs — search, filter by tier, flag suspicious |
| `/organizations/[id]` | Org detail: members, subscription, usage, billing history, audit log |
| `/users` | All users across platform, searchable by email |
| `/users/[id]` | User detail: org membership, last login, impersonate button |
| `/subscriptions` | All active subscriptions — override tier, grant trial extension, mark enterprise |
| `/billing` | MRR chart, churn, overages billed this month, failed charges |
| `/billing/invoices` | All Stripe/Paystack invoices, refund button |
| `/plans` | Plan tier config editor — update prices, feature flags, limits |
| `/queues` | BullMQ queue monitor: depth, failed jobs, retry failed, flush queue |
| `/agents` | All agent runs across platform — see failures, avg review retries |
| `/posts` | All scheduled/published posts — search, inspect content, force delete |
| `/audit-log` | Platform-wide activity log: filter by org, actor, event type |
| `/feature-flags` | Toggle features per org or globally (e.g. disable A/B for free tier) |
| `/email-templates` | Preview & edit transactional email templates (Resend) |
| `/affiliates` | Manage affiliates: approve applications, view stats, trigger payouts |
| `/support` | View recent signup errors, API 500s, failed webhook deliveries |
| `/settings` | Platform-level settings: maintenance mode, SMTP config, Stripe webhook URLs |

### API routes to add (in `api/src/routes/admin.ts`)

All under `/v1/admin/*`, gated by `requireRole('super_admin')` middleware.

```
GET  /admin/stats                    — platform-level metrics
GET  /admin/organizations            — all orgs (paginated + search)
GET  /admin/organizations/:id        — org detail + members + usage
PUT  /admin/organizations/:id        — update tier override, feature flags
GET  /admin/users                    — all users
GET  /admin/users/:id                — user detail
POST /admin/users/:id/impersonate    — issue short-lived impersonation JWT
POST /admin/subscriptions/:id/override  — force tier / extend trial
GET  /admin/queues                   — BullMQ stats per queue
POST /admin/queues/:queue/retry-failed  — retry all failed jobs
GET  /admin/audit-log                — platform audit log (paginated)
GET  /admin/feature-flags            — list all flags
PUT  /admin/feature-flags/:flag      — toggle flag per org or globally
GET  /admin/affiliates               — list affiliate accounts
PUT  /admin/affiliates/:id           — approve / suspend / update commission
POST /admin/affiliates/:id/payout    — trigger payout via Stripe/Paystack
```

### DB changes needed

```sql
-- Add to users table
ALTER TABLE users ADD COLUMN is_super_admin BOOLEAN DEFAULT FALSE;

-- Feature flags table
CREATE TABLE feature_flags (
  id UUID PRIMARY KEY,
  flag_name TEXT NOT NULL,
  enabled_globally BOOLEAN DEFAULT FALSE,
  enabled_for_orgs TEXT[] DEFAULT '{}',  -- org IDs
  disabled_for_orgs TEXT[] DEFAULT '{}'
);

-- Affiliates table (see Section 3)
```

---

## 2. Affiliate Dashboard — `affiliate/` (NEW APP)

**Is this required?** Yes, if you want referral-driven growth. For a SaaS with 6 billing tiers, an affiliate program drives low-CAC acquisition — especially for agency and scale tiers. Without it, growth relies entirely on paid/organic. Build it when you're ready to run a referral program, not before.

### What an affiliate needs

| Page | Purpose |
|---|---|
| `/dashboard` | Earnings overview: total clicks, conversions, commission earned, pending payout |
| `/links` | Generate unique referral links per campaign/source |
| `/payouts` | Payout history, pending balance, bank/PayPal details |
| `/resources` | Marketing materials (logos, banners, email templates) |
| `/settings` | Profile, payment info, notification preferences |

### API routes to add (in `api/src/routes/affiliates.ts`)

```
POST /affiliates/register            — apply to affiliate program
POST /affiliates/login               — affiliate-specific auth (or reuse user auth)
GET  /affiliates/me                  — stats, balance, tier
GET  /affiliates/links               — referral links
POST /affiliates/links               — generate new link with UTM params
GET  /affiliates/conversions         — list of converted referrals
GET  /affiliates/payouts             — payout history
POST /affiliates/payouts/request     — request payout (min threshold check)

# Tracking (public, no auth)
GET  /r/:code                        — redirect + record click (affiliate tracking pixel)
```

### DB changes needed

```sql
CREATE TABLE affiliates (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),  -- if affiliate has a user account
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'pending',       -- pending | approved | suspended
  commission_rate NUMERIC DEFAULT 0.20, -- 20% default
  total_earned_cents INTEGER DEFAULT 0,
  total_paid_cents INTEGER DEFAULT 0,
  payout_threshold_cents INTEGER DEFAULT 5000,  -- $50 minimum
  stripe_account_id TEXT,              -- Stripe Connect for payouts
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE affiliate_links (
  id UUID PRIMARY KEY,
  affiliate_id UUID REFERENCES affiliates(id),
  code TEXT NOT NULL UNIQUE,           -- short code in /r/:code
  campaign TEXT,                       -- for segmenting (e.g. "twitter-bio")
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE affiliate_conversions (
  id UUID PRIMARY KEY,
  affiliate_link_id UUID REFERENCES affiliate_links(id),
  converted_org_id UUID REFERENCES organizations(id),
  plan_tier TEXT NOT NULL,
  commission_cents INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',       -- pending | cleared | paid
  cleared_at TIMESTAMPTZ,              -- after refund window (e.g. 30 days)
  paid_at TIMESTAMPTZ
);
```

---

## 3. Campaigns — How They Work & What's Missing

### How campaigns relate to brands, agents, and plans

The entity hierarchy is:

```
Organization
  └── Brand (brand_profiles)   — identity, voice, visual assets, ingested docs
        └── Agent (agents)     — a persona tied to ONE brand; has diet instructions, prompt overrides
Campaign (campaigns)           — an org-level objective container (name, goals[], budgetCapCents)
              ↑
Marketing Plan (marketing_plans) — links brand + agent + optional campaign; generates scheduled posts
  └── Scheduled Posts          — one post per platform slot, generated by the agent
        └── Post Analytics     — engagement data synced back after publishing
```

Key rules:
- A **brand** defines the identity. An **agent** is the persona that speaks for that brand on social media. One brand can have multiple agents (e.g. one per tone/region).
- A **plan** is the execution unit: you pick a brand + agent + platforms + date range → the AI generates a schedule of posts. Plans belong to one brand and one agent.
- A **campaign** is an optional grouping layer above plans. It has no brand or agent of its own — a campaign can contain plans across multiple brands and multiple agents, since each plan independently declares its brand+agent. A campaign is purely a named objective with a shared budget cap.
- The link is a **nullable `campaignId` FK on `marketing_plans`**. Plans exist independently of campaigns; assigning a plan to a campaign is optional.
- `GET /campaigns/:id/analytics` rolls up: campaign → plans → posts → postAnalytics into a single engagement summary and per-platform breakdown.

> **Note:** The `campaign` field on `affiliate_links` is a separate, unrelated concept — it is a UTM label (e.g. `"twitter-bio"`) for segmenting affiliate tracking clicks. It has nothing to do with the marketing `campaigns` table.

### What's currently built

| Item | Status |
|---|---|
| `campaigns` DB table (`id`, `name`, `goals[]`, `budgetCapCents`) | Done |
| `campaignId` FK on `marketing_plans` | Done |
| CRUD API (`GET/POST/PATCH/DELETE /campaigns`) | Done |
| Campaign analytics API (`GET /campaigns/:id/analytics`) | Done |
| Campaigns list page (`/dashboard/campaigns`) with create form | Done |
| Campaign detail page (`/dashboard/campaigns/[id]`) — KPI cards + per-platform breakdown | Done |

### What's missing

| Item | What to do |
|---|---|
| **Assign plan to campaign at generation time** | Add `campaignId: z.string().uuid().optional()` to `GeneratePlanSchema` in `packages/config/src/schemas.ts` and pass it through in `routes/plans.ts` `POST /plans/generate` → `db.insert(marketingPlans)` |
| **Assign/move an existing plan to a campaign** | Add `campaignId` to `PUT /plans/:id` (currently only updates `name`, `goals`, `feedbackLoopEnabled`). Also add a dropdown on the plan detail UI to select a campaign. |
| **Plans list on campaign detail page** | The API returns `plans[]` in the analytics response but the frontend `[id]/page.tsx` never renders them. Add a section listing the plans under the campaign with links to each plan. |
| **Campaign status** | Add a `status` field (`active` \| `completed` \| `archived`) to the `campaigns` table. No lifecycle management exists today. |
| **Campaign date range** | Add `startDate` / `endDate` to `campaigns` table so time-bounded campaigns are queryable. Currently only plans have date ranges. |
| **Budget spend tracking** | `budgetCapCents` is stored but never decremented or compared against anything. Spend tracking requires a concept of cost-per-post (ad spend, not content cost), which doesn't exist in the current model. Either remove the field or define what "spend" means. |
| **Create campaign and generate plan in one flow** | Today the user must create a campaign, then separately generate a plan, then assign it. Add a "New plan" shortcut button on the campaign detail page that pre-fills `campaignId`. |

---

## 4. Competitive Feature Gaps

Features that Buffer, Jasper, or Copy.ai offer where Anthyx is behind. Each entry is verified against the current codebase — "absent" means zero code, "partial" means backend exists but UI or wiring is incomplete.

### 4.1 Unified Engagement Inbox — **HIGH / Missing**

**What competitors have:** Buffer ships a cross-platform comment + DM inbox. From a single view operators can read and reply to comments, DMs, and mentions across all connected accounts.

**What Anthyx has:** `auto-reply.ts` contains `runAutoReplyAgent` (full AI reply logic) and `fetchAndReplyToInbox` — but the fetch function body is entirely a stub with commented-out pseudo-code. There is no frontend inbox page and no API route (`GET /inbox`, `POST /inbox/:id/reply`).

**What to build:**
- Platform-specific inbox fetch integrations inside `fetchAndReplyToInbox` (X, Instagram, LinkedIn comment/DM APIs)
- `GET /v1/inbox` — returns paginated comments/DMs across all org social accounts, with `replied` flag
- `POST /v1/inbox/:messageId/reply` — posts reply via `social-mcp.ts`, marks as replied
- Frontend page at `/dashboard/inbox`: unified feed with filter by platform/brand, reply composer, escalation flag

### 4.2 Per-Post Analytics Drill-down — **HIGH / Partial**

**What competitors have:** Buffer and Jasper both report reach, impressions, clicks, and engagement rate at the individual post level with historical trend lines per channel.

**What Anthyx has:** `GET /analytics` returns org-wide aggregates and the last 10 published posts. `GET /analytics/brand/:id` returns content-type performance scores. `scorer.ts` computes engagement rate per content type. The frontend analytics page only shows two bar charts — posts published and avg engagement rate, both aggregated by platform. No per-post detail, no best-performing post list, no brand filter, no reach/impressions breakdown.

**What to build:**
- Extend `GET /analytics` to accept `brandProfileId` query param for per-brand filtering in the UI
- Add `GET /analytics/posts` — paginated list of published posts sorted by engagement rate, including `reach`, `impressions`, `likes`, `clicks` from `postAnalytics`
- Add `GET /analytics/posts/:postId` — full detail for a single post
- Frontend: best-performing posts table on the analytics page, with per-post modal showing all metrics + a link to the original post

### 4.3 AI Image Generation UI — **MEDIUM / Backend done, UI missing**

**Note:** Anthyx is *not* text-only — AI image generation is fully built. `ai-generator.ts` calls Gemini Imagen 3 and uploads to CDN. `template-renderer.ts` supports BannerBear template cards. `generator.ts` routes between the two tracks. The MCP tool `generate_image_asset` is available to agents. Generation is triggered automatically when the agent sets `suggestedMediaPrompt` or writes `[GENERATE_IMAGE]` in the content.

**What's missing:** Users have no way to see or manage images from the UI. In the HITL review queue, there is no image preview alongside the post text. Users can't manually request image regeneration or swap the image. There's no indicator that an image was generated.

**What to build:**
- Show generated image URL (if any) alongside post text in the review page (`/dashboard/review`)
- Add "Regenerate image" button per post in the HITL queue — calls a new `POST /posts/:id/regenerate-image`
- Show image thumbnail in the posts list page
- Expose `suggestedMediaPrompt` as an editable field in the post editor so users can guide generation

### 4.4 SEO Layer — **MEDIUM / Absent**

**What competitors have:** Jasper integrates SurferSEO for keyword suggestions and readability scoring inline in the writing flow, aimed at blog and web copy use cases.

**What Anthyx has:** Nothing. No keyword tooling, no readability scoring, no SEO integration anywhere in the codebase.

**Is this a priority for Anthyx?** Only if targeting blog/web copy alongside social — which the `blog-repurposer.ts` service suggests is a goal. Medium priority.

**What to build:**
- Add a readability score to the post review page (Flesch-Kincaid via a lightweight npm package — no external API needed)
- Add `GET /v1/seo/keywords?topic=X&brand=Y` — calls web search trends tool + LLM to suggest 5-10 keywords for the topic in the brand's niche
- Surface keyword suggestions and readability score in the HITL editor as a sidebar panel (not a blocker for approval, just informational)

### 4.5 RSS / Live Competitor Feed Auto-Ingestion — **MEDIUM / Absent**

**What competitors have:** Buffer pulls competitor and industry content via RSS for repurposing ideas. Content is curated automatically — operators don't need to manually trigger research.

**What Anthyx has:** `competitor-analysis.ts` MCP tool runs on-demand research when agents invoke it. `web-search-trends.ts` fetches live trend data on demand. No automated feed subscription.

**What to build:**
- DB table: `rss_feeds (id, organizationId, brandProfileId, feedUrl, label, lastFetchedAt, isActive)`
- `POST /v1/brands/:id/feeds` — register an RSS feed URL
- A scheduled worker (`feeds.worker.ts`) that runs hourly: fetches new items from all registered feeds, stores them as raw intel in a `feedItems` table, flags relevant ones for agent use
- `GET /v1/brands/:id/feeds/items` — returns recent feed items for the brand
- Feed items should be injectable into `strategist.ts` context when building a content plan so the agent can reference real recent industry events

### 4.6 A/B Test UI — **MEDIUM / Service done, UI missing**

Already tracked in §5.3, repeated here for competitive context. Copy.ai auto-generates multiple copy versions; Anthyx's `ab-tester.ts` is a complete service (`generateAbVariants`, `evaluateAndPromoteWinner`) and `abTests` DB table exists. Route exists at `POST /posts/:id/ab-test`. The only gap is the frontend — build the UI per §5.3.

### 4.7 CRM / Content-to-Conversion Tracking — **LATER / Absent**

**What competitors have:** Copy.ai positions as a GTM platform — connecting marketing content to sales pipeline outcomes. Content-to-conversion tracking lets operators see which posts drove leads or revenue.

**What Anthyx has:** Nothing. The `postAnalytics` table tracks engagement (likes, shares) but not downstream conversion events.

**What to build (when ready for enterprise tier):**
- Add `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` fields to post generation — auto-append UTM params to links in posts
- Webhook receiver for conversion events from CRMs (HubSpot, Salesforce) or simple event ping endpoint
- Attribution model: match conversion events to the post's UTM params
- Surface in analytics: "posts that drove conversions this month"

### 4.8 Plagiarism / Originality Check — **LATER / Absent**

**What competitors have:** Jasper includes a Copyscape plagiarism check on generated content.

**What Anthyx has:** Nothing. The reviewer agent checks brand-voice adherence but not originality.

**What to build:** Call Copyscape SERP API or similar before sending content to HITL approval — flag if similarity score exceeds threshold. Block or warn in the review queue.

---

## 5. Missing Features in Existing Apps

### 5.1 Authentication (`api/` + `frontend/`)

| Item | Status | What to do |
|---|---|---|
| Email/password login | Done | — |
| Password reset | Frontend pages exist (`forgot-password/`, `reset-password/`), need to verify wiring to API | Test end-to-end |
| Google OAuth | Missing | Add via next-auth `GoogleProvider` in `frontend/lib/auth.ts` |
| Two-factor auth (TOTP) | Missing | Add `totp_secret` to users table, QR code setup page, verify on login |
| API key management | Missing | Users create API keys for CLI / integrations (table: `api_keys`, hashed) |
| Session revocation | Missing | JWT is stateless — add a Redis denylist for logout + password change |
| Email verification on register | Missing | Currently registers immediately — add `email_verified` flag + Resend verification email |

### 5.2 Billing (`api/src/routes/billing.ts` + `services/billing/`)

| Item | Status | What to do |
|---|---|---|
| Stripe Subscribe | Done | — |
| Paystack Subscribe | Done | — |
| Upgrade/Downgrade | Done | — |
| Overage invoicing | Done (`overage.ts`, `overage.worker.ts`) | Verify cron fires correctly |
| Trial-to-paid conversion email | Missing | Send Resend email 3 days before trial ends |
| Dunning (failed payment retry) | Missing | Handle `invoice.payment_failed` Stripe webhook + email sequence |
| Paused subscription (grace period) | Missing | Add `suspended` grace period before cancelling access |
| Annual billing discount UI | Missing | Billing page toggle for monthly/annual — currently API-only |
| Invoice PDF download | Missing | Stripe has invoice PDF URL — expose it in `/billing/invoices` |
| Proration preview before upgrade | Missing | Call Stripe `retrieveUpcomingInvoice` and show user the charge before confirming |
| Enterprise quote flow | Missing | Enterprise tier = custom pricing — add "Contact sales" CTA with Cal.com embed or email form |

### 5.3 Posts & Planning

| Item | Status | What to do |
|---|---|---|
| Manual post creation | Route exists (`POST /v1/posts`), no clear UI path | Add "New Post" button on posts page |
| Content calendar view | Missing | Visual 30-day calendar on plans/[id] (currently list view only) |
| Bulk approve in HITL queue | Route exists, UI unknown | Add "Approve All" / "Approve Next 10" in review page |
| Post preview (platform mockup) | Missing | Render how post will look on X, LinkedIn, Instagram before approving |
| Drag-and-drop reschedule | Missing | Calendar drag to reschedule a post (calls `PUT /posts/:id`) |
| Content recycling | Missing | "Re-publish best posts" — surface top performers by engagement, re-queue |
| Post versioning | Missing | When post is edited in HITL, store previous versions (audit trail) |
| A/B test UI | `ab-tester.ts` service + `abTests` DB table exist | Build UI: create variant B, view winner after N days |
| Post failure alerts | Missing | When `status = failed`, send email/webhook notification |

### 5.4 Agents

| Item | Status | What to do |
|---|---|---|
| Auto-reply UI | `auto-reply.ts` service exists | Add toggle in agent settings: enable auto-reply, configure tone for replies |
| Agent performance scoring | `scorer.ts` exists | Surface score in agent detail page (which voice traits drive engagement) |
| Agent cloning | Missing | Duplicate an agent with all its settings to a new brand |
| Diet instruction UI | DB field exists | Verify the agents/[id] page has a text area for diet instructions |
| Per-agent guardrail overrides | Missing | Agents inherit org guardrails — add per-agent additional restrictions |

### 5.5 Analytics & Reporting

| Item | Status | What to do |
|---|---|---|
| Post analytics | `scorer.ts`, `analytics.worker.ts` exist | Verify analytics page shows per-post stats |
| Platform breakdown | Missing | Chart: engagement by platform (X vs LinkedIn vs Instagram) |
| Best posting times | Missing | Heatmap of engagement by day/hour from historical data |
| Hashtag analytics | Missing | Which hashtags drive most reach — aggregate from `postAnalytics` |
| Competitor analysis UI | `competitor-analysis.ts` MCP tool exists | Build UI to input competitor handles, view analysis in brand profile |
| Exportable reports | `reports.ts` route exists | Add CSV/PDF export button on reports page |
| Usage analytics (admin-only) | Missing | Separate from post analytics — track feature adoption across orgs |

### 5.6 Team & Collaboration

| Item | Status | What to do |
|---|---|---|
| Team invites | Done (email token flow) | — |
| RBAC stages | Done (plan_review, hitl, legal_review, analytics_only) | — |
| Comments on posts | Missing | Reviewers should be able to leave comments on posts before approving/vetoing |
| Notification preferences | Missing | Per-user setting: get notified on post approval, failure, new plan |
| @mentions in comments | Missing | Tag team members in post comments |

### 5.7 Brand & Content

| Item | Status | What to do |
|---|---|---|
| Brand ingestion | Done (PDF, URL, Markdown) | — |
| Content pillar configuration | Missing | Let users define their content pillars (Education 40%, Promo 20%, etc.) |
| Tone slider UI | Missing | Visual slider for brand tone (formal ↔ casual, serious ↔ playful) |
| Brand health score | Missing | Score how consistent generated content is with brand guidelines |
| Multi-language support | Missing | Agent should generate content in brand's target language(s) |

### 5.8 Social Accounts

| Item | Status | What to do |
|---|---|---|
| OAuth connect | Done | — |
| Token refresh | Done | — |
| Account health check | Missing | Surface expired/invalid tokens proactively on the accounts page |
| Multi-account per platform | Missing | Some orgs run multiple X accounts — allow per-agent account assignment |
| Platform-specific limits display | `PLATFORM_CONSTRAINTS` type exists | Show char limit, hashtag limit inline in post editor |

---

## 6. Technical Debt & Infrastructure

### 6.1 API

| Item | Status | Fix |
|---|---|---|
| Rate limiting | Missing | Add `@hono/rate-limiter` or `express-rate-limit` — 100 req/min per org |
| CORS configuration | Unknown | Verify `cors()` is configured for production domain (not `*`) |
| Request logging | Unknown | Add Pino/Winston structured logging — critical for debugging production issues |
| Error monitoring | Missing | Add Sentry SDK (`@sentry/node`) — captures unhandled errors with stack traces |
| OpenAPI / Swagger docs | Missing | Generate from Zod schemas using `zod-openapi` — unblocks API consumers |
| Health check endpoint | Unknown | Add `GET /health` returning `{ status: 'ok', db: true, redis: true }` |
| API versioning strategy | Unclear | `/v1/` prefix exists — document the versioning policy |
| `config.ts` at monorepo root | Exists | Move into `packages/config/src/index.ts` and delete root file (per adjustments.md) |
| Database connection pooling | Unknown | Verify postgres.js pool size is tuned for production load |
| Missing `posts` route in some references | Minor | Ensure `routes/posts.ts` is mounted in `index.ts` |

### 6.2 Frontend (`frontend/`)

| Item | Status | Fix |
|---|---|---|
| Next-auth integration | `lib/auth.ts` referenced in adjustments.md | Verify it exists and is wired to login page |
| Error boundaries | Missing | Add `error.tsx` per route segment for graceful error display |
| Loading skeletons | Unknown | Add `loading.tsx` for all data-heavy pages (plans, posts, analytics) |
| Empty states | Unknown | Every list page needs a friendly empty state with a CTA |
| Toast notifications | Unknown | Add `sonner` or `react-hot-toast` for action feedback |
| Form validation | Unknown | Zod + `react-hook-form` on all forms — match API Zod schemas |
| Mobile responsiveness | Unknown | Test all pages at 375px — sidebar needs a hamburger menu on mobile |
| Dark mode | Unknown | Add `dark:` Tailwind variants — many SaaS users prefer dark mode |
| Keyboard shortcuts | Missing | `k` for command palette, `n` for new post, `r` for review queue |
| Optimistic UI updates | Missing | TanStack Query `useMutation` with `onMutate` for instant UI feedback |
| Accessibility (a11y) | Unknown | ARIA labels on icon buttons, focus traps in modals, keyboard navigation |
| `posts/` page | Exists as folder | Verify it has a `page.tsx` — not shown in initial listing |

### 6.3 Workers

| Item | Status | Fix |
|---|---|---|
| `overage.worker.ts` | Exists | Verify cron schedule (nightly 2am) is correctly configured |
| `ingestor.worker.ts` | Exists | Verify it handles PDF/URL parsing failures gracefully (retry + DLQ) |
| `notification.worker.ts` | Exists | Verify webhook delivery retries on failure (exponential backoff) |
| Dead-letter queues | Unknown | Add DLQ for all workers — failed jobs should not silently disappear |
| Worker health metrics | Missing | Expose BullMQ queue depths to the admin dashboard |

### 6.4 Testing

| Item | Status | Fix |
|---|---|---|
| Unit tests | Missing | Add Vitest for services (billing limits, usage tracker, guardrails) |
| Integration tests | Missing | Test full agent pipeline against a test DB |
| E2E tests | Missing | Playwright for critical paths: register → create brand → generate plan → approve post |
| Load testing | Missing | k6 or Artillery for post-execution worker under load |

### 6.5 DevOps / CI

| Item | Status | Fix |
|---|---|---|
| GitHub Actions CI | Unknown | Add: install → type-check → lint → test on every PR |
| DB migration in CI | Missing | Run `db:migrate` in CI against a test Postgres instance |
| Docker image tagging | Unknown | Tag with git SHA for traceable deployments |
| Environment variable validation at startup | Partially done (`schemas.ts`) | Confirm it throws loudly if required vars are missing |
| Log aggregation | Missing | Configure Pino → Loki or Datadog for production |
| Uptime monitoring | Missing | Add BetterUptime or UptimeRobot for `/health` endpoint |

---

## 7. New Features (Future Roadmap)

These are not blockers for launch but are high-value for growth and retention.

| Feature | Why |
|---|---|
| **Content library / templates** | Users save high-performing post formats to reuse — reduces reliance on agents for routine content |
| **Onboarding wizard** | Step-by-step setup: connect brand → ingest docs → connect account → generate first plan. Reduces time-to-value |
| **In-app notification center** | Bell icon with unread count — post approved, post failed, plan ready, usage warning |
| **AI caption editor** | Inline "Improve this caption" / "Make it shorter" buttons on individual posts in HITL queue |
| **White-label portal** | Agency tier: custom subdomain (`agency.client.com`), replace Anthyx branding with client branding |
| **Multi-workspace** | Enterprise: manage multiple independent workspaces (different brands, teams) under one billing account |
| **Mobile app (React Native / PWA)** | Approve/veto posts from phone — HITL reviewers especially need this |
| **Zapier / Make integration** | Connect Anthyx to 1000+ apps via webhooks: trigger post creation from CRM events, etc. |
| **AI trend briefing** | Weekly email digest: "Here are the trending topics in your niche this week" — powered by Strategist |
| **Post scheduling conflict detection** | Warn when two posts are scheduled within 2 hours on the same account |
| **Content gap analysis** | "You haven't posted about [pillar] in 14 days" — surface in dashboard |
| **RSS/blog auto-ingest** | Monitor a blog RSS feed → auto-generate social posts from new articles |
| **Social listening** | Monitor brand mentions across platforms → surface in analytics |
| **Sentiment analysis on comments** | Classify comment sentiment on published posts → feed back into agent voice tuning |
| **Commission/revenue share for agencies** | White-label agencies resell seats — track sub-org revenue, compute agency's share |
| **Ideas board** | Scratchpad for content ideas before they become full plans — Buffer calls this "Ideas". Table: `ideas (id, orgId, brandId, title, notes, status)`. Lightweight CRUD, no agent needed. |
| **Hashtag manager** | Save/organise branded hashtag sets per brand (e.g. "product launch set", "awareness set"). Auto-attach a set to post generation. Agents already generate hashtags — this lets users curate and reuse them. |
| **First comment scheduling (configurable)** | `social-mcp.ts` already posts hashtags as first comment on Instagram + Threads. Extend this to be user-configurable: any text as first comment, on any platform that supports it (LinkedIn, Facebook). |
| **Google Docs / OneDrive export** | Export generated posts directly to a Google Doc or OneDrive file — useful for teams whose approval workflow lives outside Anthyx. |

---

## 8. Email Marketing & Pinterest via `social-mcp` npm package

> **Note:** `social-mcp` (npm) is Anthyx's own published MCP server package. It already supports Pinterest and Email natively. Do not build custom implementations — integrate via this package.

### What `social-mcp` provides

| Platform | Tools available |
|---|---|
| **Pinterest** | `PINTEREST_GET_BOARDS`, `PINTEREST_CREATE_BOARD`, `PINTEREST_CREATE_PIN`, `PINTEREST_GET_PIN`, `PINTEREST_GET_BOARD_PINS`, `PINTEREST_DELETE_PIN` |
| **Email** | `EMAIL_SEND` (single recipient), `EMAIL_SEND_BULK` (multiple recipients) |

Email drivers: `MAIL_MAILER=smtp` (SMTP/Gmail), `sendgrid` (SendGrid API key), or `mailgun` (Mailgun API key). Switching providers requires only changing the env var — no code changes.

### Integration approach

`social-mcp` runs as a standalone MCP server process (`npx social-mcp`). The right integration is to add it as a service in `docker-compose.yml` and expose its tools to Anthyx agents alongside the existing `services/mcp/` server.

**Add to `docker-compose.yml`:**
```yaml
social-mcp:
  image: node:22-alpine
  command: npx social-mcp
  environment:
    PINTEREST_ACCESS_TOKEN: "${PINTEREST_ACCESS_TOKEN}"
    MAIL_MAILER: "${MAIL_MAILER}"          # smtp | sendgrid | mailgun
    MAIL_FROM_ADDRESS: "${MAIL_FROM_ADDRESS}"
    MAIL_FROM_NAME: "${MAIL_FROM_NAME}"
    # SMTP vars (if MAIL_MAILER=smtp)
    MAIL_HOST: "${MAIL_HOST}"
    MAIL_PORT: "${MAIL_PORT}"
    MAIL_USERNAME: "${MAIL_USERNAME}"
    MAIL_PASSWORD: "${MAIL_PASSWORD}"
    MAIL_ENCRYPTION: "${MAIL_ENCRYPTION}"
    # Or SendGrid: SENDGRID_API_KEY
    # Or Mailgun: MAILGUN_API_KEY, MAILGUN_DOMAIN
  ports:
    - "3200:3200"
  restart: unless-stopped
```

**Wire into agent pipeline (`api/src/mcp/server.ts`):**
- Register the `social-mcp` MCP server as an additional tool source alongside the existing MCP tools
- Agents can then call `PINTEREST_CREATE_PIN` and `EMAIL_SEND` / `EMAIL_SEND_BULK` directly

### Pinterest — what to build in Anthyx

- Add `pinterest` to the `Platform` type in `packages/types/src/`
- In `api/src/services/posting/executor.ts`: when platform is `pinterest`, call `PINTEREST_CREATE_PIN` via the `social-mcp` MCP connection instead of `publishPost` in `social-mcp.ts`
  - Pinterest requires `imageUrl` — ensure `mediaUrl` is populated (fall back to `generate_image_asset` tool)
  - `boardId` stored on the social account record (`accountId` field)
- Add `PINTEREST_GET_BOARD_PINS` call in `analytics.worker.ts` for engagement data (saves, impressions)
- Frontend: add Pinterest to the platform selector on account connection and plan generation

### Email marketing — what to build in Anthyx

Email newsletters are a distinct channel — agent generates the content, `social-mcp` sends it.

**Backend**
- Add `email` to the `Platform` type
- DB table for email campaigns:
  ```sql
  CREATE TABLE email_campaigns (
    id UUID PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id),
    brand_profile_id UUID REFERENCES brand_profiles(id),
    subject TEXT NOT NULL,
    preview_text TEXT,
    html_body TEXT NOT NULL,
    plain_text TEXT,
    recipient_list TEXT[],         -- email addresses (or audience tag for future CRM integration)
    status TEXT DEFAULT 'draft',   -- draft | scheduled | sent
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    opens INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```
- `POST /v1/email-campaigns` — create draft
- `POST /v1/email-campaigns/:id/send` — call `EMAIL_SEND_BULK` on `social-mcp` with recipient list
- Add email copy instructions to `copywriter.ts` — email needs subject line, preview text, and body with CTA (longer form than social posts)

**Frontend**
- `/dashboard/email` — list of email campaigns per brand with open/click stats
- Draft editor: subject, preview text, body (Markdown or rich text), recipient list
- "Generate with AI" button — invokes agent with `platform: "email"` to draft the full campaign
- Schedule or send immediately button → calls `/email-campaigns/:id/send`

### `social-mcp` also helps with the engagement inbox (§4.1)

The package's read tools can seed the engagement inbox without building custom platform fetch code:

| Tool | Use in Anthyx inbox |
|---|---|
| `SEARCH_TWEETS` | Fetch recent mentions on X |
| `GET_INSTAGRAM_POSTS` | Fetch recent Instagram post comments |
| `GET_FACEBOOK_POSTS` | Fetch recent Facebook page activity |
| `GET_LINKEDIN_POSTS` | Fetch recent LinkedIn post activity |
| `GET_DISCORD_MESSAGES` | Fetch recent channel messages |

Wire these into `fetchAndReplyToInbox` in `auto-reply.ts` to replace the current stub.

---

## 9. Promo Codes

Promo codes are essential for launch campaigns, influencer deals, and affiliate onboarding. Both Stripe and Paystack support them natively.

### DB table

```sql
CREATE TABLE promo_codes (
  id UUID PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL,     -- 'percent' | 'fixed_cents'
  discount_value INTEGER NOT NULL, -- e.g. 20 for 20%, or 5000 for $50
  applicable_tiers TEXT[],         -- null = all tiers
  max_uses INTEGER,                -- null = unlimited
  used_count INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  stripe_coupon_id TEXT,           -- mirror in Stripe for server-side application
  paystack_plan_code TEXT,         -- mirror in Paystack if applicable
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### API routes (in `api/src/routes/billing.ts`)

```
POST /billing/validate-promo        — validate code, return discount details (public)
POST /billing/subscribe             — existing route; extend to accept promoCode param
GET  /admin/promo-codes             — list all codes (admin only)
POST /admin/promo-codes             — create new code (admin only)
PATCH /admin/promo-codes/:id        — activate / deactivate / update (admin only)
```

### Frontend

- Input field on `/dashboard/billing/upgrade` — "Got a promo code?" collapses to reveal a text input; validate on blur via `POST /billing/validate-promo`, show discount preview
- Admin: `/admin/promo-codes` table with create modal (code, type, value, max uses, expiry, applicable tiers)

### Stripe integration

Create a Stripe `Coupon` when the admin creates a promo code, store `stripe_coupon_id`. Apply it at subscription creation via `promotion_code` param on `stripe.subscriptions.create`.

### Paystack integration

Paystack has discount codes on plans. Create a Paystack plan with a discounted amount or apply the discount manually before calculating the charge.

---

## 10. Folder Structure Adjustments

### Current structure (problem areas)

```
Anthyx/
├── apps/
│   └── api/          ← only app here; apps/ adds no value as a wrapper
├── frontend/         ← at root (correct — this is the target pattern for all apps)
├── services/
│   ├── agent/        ← disabled in docker-compose (conflicts with api workers)
│   ├── ingestor/
│   └── mcp/
├── packages/
│   ├── config/
│   ├── types/
│   └── queue-contracts/
├── config.ts         ← stale root file, should be in packages/config
└── scripts/
```

### Why `api/` at root, not `apps/api/`

The goal is eventual separation of each deployable unit into its own repo. A flat structure where every app sits at the root means extraction is just moving a folder — no extra `apps/` layer to strip. `frontend/` is already at the root and works correctly, so the pattern is proven. The cleaner target:

```
Anthyx/
├── api/              ← was apps/api/
├── frontend/         ← already here
├── admin/            ← new
├── affiliate/        ← new
├── services/
│   ├── ingestor/
│   └── mcp/
├── packages/
│   ├── config/
│   ├── types/
│   └── queue-contracts/
├── scripts/
└── docs/
```

### Migration steps for `apps/api` → `api/`

This is a one-time rename. Impact is contained:

1. `git mv apps/api api/` — move the folder
2. `pnpm-workspace.yaml` — replace `"apps/*"` with `"api"` (and add `"admin"`, `"affiliate"` explicitly when ready)
3. Root `package.json` workspaces — same update
4. `turbo.json` — no path changes needed (turbo reads workspaces from package.json)
5. `docker-compose.yml` — change `dockerfile: apps/api/Dockerfile` → `dockerfile: api/Dockerfile` (two lines: api service and worker service)
6. `docker-compose.prod.yml` — same update
7. Root `package.json` scripts — `cd apps/api` → `cd api` in `db:migrate`, `db:generate`, `db:studio`
8. `Makefile` — check for any `apps/api` references
9. `api/package.json` — name stays `@anthyx/api`; no internal path changes needed
10. Any CI/CD scripts referencing `apps/api/`

> **Do this before building `admin/` or `affiliate/` to avoid having to redo it.**

### Other structural fixes

| Item | Fix |
|---|---|
| `config.ts` at monorepo root | Move contents into `packages/config/src/index.ts` and delete the root file. Already flagged — do it during the `apps/api → api/` migration |
| `services/agent/` | Currently **disabled** — it competes with `api` workers on the same BullMQ queues and has bugs (hardcoded prompt, silent null-account skips). Either fix it properly or delete it. Leaving dead code in a disabled state is a maintenance liability. |
| Root `package.json` workspaces | Currently lists `["apps/*", "packages/*"]` but `pnpm-workspace.yaml` has `["apps/*", "services/*", "frontend", "packages/*"]` — they are **out of sync**. After the `api/` rename, update both to `["api", "admin", "affiliate", "frontend", "services/*", "packages/*"]` (list each app explicitly). |
| `docs/` folder | `structure.md`, `technical.md`, `StackUpdate.md` — verify these are up to date or consolidate into `README.md` and `architecture.md` at root |

---

## 11. Summary — Priority Order

### Immediate (launch blockers)
1. Verify all frontend pages are complete and wired to API (especially `posts/`, `review/`, `plans/[id]`)
2. Password reset end-to-end test
3. Rate limiting on API
4. Error monitoring (Sentry)
5. Health check endpoint

### Short-term (1-4 weeks)
6. **`apps/api` → `api/` rename** — do this before adding more apps (§10)
7. Fix `pnpm-workspace.yaml` / `package.json` workspace list mismatch (§10)
8. Admin dashboard (`admin/`) — operator visibility is critical (§1)
9. Email verification on register
10. Annual billing toggle in UI
11. Promo code support — Stripe + Paystack + admin UI (§9)
12. **Add `social-mcp` as Docker service** — configure `PINTEREST_ACCESS_TOKEN` + mail env vars; wire into agent pipeline (§8)
13. **Pinterest platform support** — add to `Platform` type, wire `PINTEREST_CREATE_PIN` in executor, add to account connect UI (§8)
14. **Unified engagement inbox** — use `social-mcp` read tools (`SEARCH_TWEETS`, `GET_INSTAGRAM_POSTS`, etc.) to replace the stub in `auto-reply.ts`; add route + frontend page (§4.1, §8)
15. **Per-post analytics drill-down** — best-performers table, brand filter in analytics UI (§4.2)
16. **AI image preview in HITL queue** — surface `mediaUrl` in review page (§4.3)
17. Post failure notifications
18. Basic onboarding wizard

### Medium-term (1-3 months)
19. Affiliate dashboard (`affiliate/`) — if running a referral program (§2)
20. Email marketing channel — agent generates copy, `EMAIL_SEND_BULK` via `social-mcp` sends it; add `email_campaigns` table + `/dashboard/email` UI (§8)
21. A/B test UI (service already built, §4.6)
22. Competitor analysis UI (MCP tool already built)
23. RSS / live competitor feed auto-ingestion (§4.5)
24. SEO readability scoring in post editor (§4.4)
25. Hashtag manager (§7)
26. Ideas board (§7)
27. 2FA / TOTP

### Long-term
28. Mobile app / PWA
29. White-label portal
30. Social listening
31. Zapier integration
32. Multi-workspace support
33. CRM / content-to-conversion tracking (§4.7)
34. Plagiarism checker (§4.8)
35. Google Docs / OneDrive export (§7)
36. `services/agent/` — fix or delete (§10)
