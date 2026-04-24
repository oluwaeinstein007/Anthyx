# Anthyx — Improvement & Roadmap

> Status as of April 2026. Covers what needs to be built, updated, or fixed across the full stack.

---

## 1. Admin Dashboard — `admin/` (NEW APP)

A separate Next.js app at `admin/` (monorepo root, alongside `frontend/`) for platform operators. Completely isolated from the user-facing `frontend/`. Protected by a separate `ADMIN_SECRET` or an `is_super_admin` flag on the users table.

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

### API routes to add (in `apps/api/src/routes/admin.ts`)

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

### API routes to add (in `apps/api/src/routes/affiliates.ts`)

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

## 4. Missing Features in Existing Apps

### 4.1 Authentication (`apps/api` + `frontend/`)

| Item | Status | What to do |
|---|---|---|
| Email/password login | Done | — |
| Password reset | Frontend pages exist (`forgot-password/`, `reset-password/`), need to verify wiring to API | Test end-to-end |
| Google OAuth | Missing | Add via next-auth `GoogleProvider` in `frontend/lib/auth.ts` |
| Two-factor auth (TOTP) | Missing | Add `totp_secret` to users table, QR code setup page, verify on login |
| API key management | Missing | Users create API keys for CLI / integrations (table: `api_keys`, hashed) |
| Session revocation | Missing | JWT is stateless — add a Redis denylist for logout + password change |
| Email verification on register | Missing | Currently registers immediately — add `email_verified` flag + Resend verification email |

### 4.2 Billing (`apps/api/src/routes/billing.ts` + `services/billing/`)

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

### 4.3 Posts & Planning

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

### 4.4 Agents

| Item | Status | What to do |
|---|---|---|
| Auto-reply UI | `auto-reply.ts` service exists | Add toggle in agent settings: enable auto-reply, configure tone for replies |
| Agent performance scoring | `scorer.ts` exists | Surface score in agent detail page (which voice traits drive engagement) |
| Agent cloning | Missing | Duplicate an agent with all its settings to a new brand |
| Diet instruction UI | DB field exists | Verify the agents/[id] page has a text area for diet instructions |
| Per-agent guardrail overrides | Missing | Agents inherit org guardrails — add per-agent additional restrictions |

### 4.5 Analytics & Reporting

| Item | Status | What to do |
|---|---|---|
| Post analytics | `scorer.ts`, `analytics.worker.ts` exist | Verify analytics page shows per-post stats |
| Platform breakdown | Missing | Chart: engagement by platform (X vs LinkedIn vs Instagram) |
| Best posting times | Missing | Heatmap of engagement by day/hour from historical data |
| Hashtag analytics | Missing | Which hashtags drive most reach — aggregate from `postAnalytics` |
| Competitor analysis UI | `competitor-analysis.ts` MCP tool exists | Build UI to input competitor handles, view analysis in brand profile |
| Exportable reports | `reports.ts` route exists | Add CSV/PDF export button on reports page |
| Usage analytics (admin-only) | Missing | Separate from post analytics — track feature adoption across orgs |

### 4.6 Team & Collaboration

| Item | Status | What to do |
|---|---|---|
| Team invites | Done (email token flow) | — |
| RBAC stages | Done (plan_review, hitl, legal_review, analytics_only) | — |
| Comments on posts | Missing | Reviewers should be able to leave comments on posts before approving/vetoing |
| Notification preferences | Missing | Per-user setting: get notified on post approval, failure, new plan |
| @mentions in comments | Missing | Tag team members in post comments |

### 4.7 Brand & Content

| Item | Status | What to do |
|---|---|---|
| Brand ingestion | Done (PDF, URL, Markdown) | — |
| Content pillar configuration | Missing | Let users define their content pillars (Education 40%, Promo 20%, etc.) |
| Tone slider UI | Missing | Visual slider for brand tone (formal ↔ casual, serious ↔ playful) |
| Brand health score | Missing | Score how consistent generated content is with brand guidelines |
| Multi-language support | Missing | Agent should generate content in brand's target language(s) |

### 4.8 Social Accounts

| Item | Status | What to do |
|---|---|---|
| OAuth connect | Done | — |
| Token refresh | Done | — |
| Account health check | Missing | Surface expired/invalid tokens proactively on the accounts page |
| Multi-account per platform | Missing | Some orgs run multiple X accounts — allow per-agent account assignment |
| Platform-specific limits display | `PLATFORM_CONSTRAINTS` type exists | Show char limit, hashtag limit inline in post editor |

---

## 5. Technical Debt & Infrastructure

### 5.1 API

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

### 5.2 Frontend (`frontend/`)

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

### 5.3 Workers

| Item | Status | Fix |
|---|---|---|
| `overage.worker.ts` | Exists | Verify cron schedule (nightly 2am) is correctly configured |
| `ingestor.worker.ts` | Exists | Verify it handles PDF/URL parsing failures gracefully (retry + DLQ) |
| `notification.worker.ts` | Exists | Verify webhook delivery retries on failure (exponential backoff) |
| Dead-letter queues | Unknown | Add DLQ for all workers — failed jobs should not silently disappear |
| Worker health metrics | Missing | Expose BullMQ queue depths to the admin dashboard |

### 5.4 Testing

| Item | Status | Fix |
|---|---|---|
| Unit tests | Missing | Add Vitest for services (billing limits, usage tracker, guardrails) |
| Integration tests | Missing | Test full agent pipeline against a test DB |
| E2E tests | Missing | Playwright for critical paths: register → create brand → generate plan → approve post |
| Load testing | Missing | k6 or Artillery for post-execution worker under load |

### 5.5 DevOps / CI

| Item | Status | Fix |
|---|---|---|
| GitHub Actions CI | Unknown | Add: install → type-check → lint → test on every PR |
| DB migration in CI | Missing | Run `db:migrate` in CI against a test Postgres instance |
| Docker image tagging | Unknown | Tag with git SHA for traceable deployments |
| Environment variable validation at startup | Partially done (`schemas.ts`) | Confirm it throws loudly if required vars are missing |
| Log aggregation | Missing | Configure Pino → Loki or Datadog for production |
| Uptime monitoring | Missing | Add BetterUptime or UptimeRobot for `/health` endpoint |

---

## 6. New Features (Future Roadmap)

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

---

## 7. Summary — Priority Order

### Immediate (launch blockers)
1. Verify all frontend pages are complete and wired to API (especially `posts/`, `review/`, `plans/[id]`)
2. Password reset end-to-end test (new pages exist in `frontend/(auth)/`)
3. Rate limiting on API
4. Error monitoring (Sentry)
5. Health check endpoint

### Short-term (1-4 weeks)
6. Admin dashboard (`apps/admin/`) — operator visibility is critical
7. Email verification on register
8. Annual billing toggle in UI
9. Post failure notifications
10. Basic onboarding wizard

### Medium-term (1-3 months)
11. Affiliate dashboard (`apps/affiliate/`) — if running a referral program
12. A/B test UI (service already built)
13. Auto-reply UI (service already built)
14. Competitor analysis UI (MCP tool already built)
15. 2FA / TOTP

### Long-term
16. Mobile app / PWA
17. White-label portal
18. Social listening
19. Zapier integration
20. Multi-workspace support
