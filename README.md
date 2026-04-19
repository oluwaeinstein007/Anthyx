# Anthyx

**Autonomous multi-agent marketing platform.** Anthyx ingests a brand's identity — voice, tone, values, colors — and runs a four-agent AI pipeline that generates, reviews, schedules, and publishes content across 14 social platforms without human intervention.

---

## How it works

```
Brand Profile → Strategist → Copywriter → Reviewer → [HITL] → Publisher
                                                    ↑
                                          Engagement Feedback Loop
```

| Agent | Model | Role |
|---|---|---|
| **Strategist** | Gemini 1.5 Pro (agentic + MCP tools) | Generates a 30-day content calendar using brand context, live trend search, competitor analysis, and past engagement data |
| **Copywriter** | Claude Sonnet (structured output) | Writes post copy, hashtags, and media prompts per plan item; supports thread/carousel segments and multi-locale output |
| **Reviewer** | Claude Haiku (adversarial) | Rejects or rewrites drafts against brand guardrails; up to 2 automatic retries before HITL escalation |
| **Auto-Reply** | Claude Sonnet | Monitors platform inboxes and generates brand-voice replies to comments and DMs; escalates edge cases to humans |

---

## Supported platforms

| Platform | Publish | Engagement | Format notes |
|---|---|---|---|
| **X / Twitter** | ✅ | ✅ | 280-char hard limit, 2 hashtags max |
| **Instagram** | ✅ | ✅ | Hashtags as first comment, 2200-char caption |
| **LinkedIn** | ✅ | ✅ | Markdown stripped, max 3 inline hashtags |
| **Facebook** | ✅ | ✅ | Plain text, 400-char soft limit |
| **Telegram** | ✅ | — | Telegram Markdown v1, no char limit |
| **TikTok** | ✅ | — | Hook within first 100 chars, 3–5 hashtags |
| **Threads** | ✅ | — | Hashtags as first comment, 500-char limit |
| **Bluesky** | ✅ | — | 300-char limit, no markdown |
| **Discord** | ✅ | — | Full Markdown pass-through |
| **Reddit** | ✅ | — | Title + body split, no hashtags |
| **YouTube** | ✅ | — | Hashtags in description body |
| **WhatsApp** | ✅ | — | WhatsApp-specific bold/italic syntax |
| **Slack** | ✅ | — | Slack mrkdwn conversion |
| **Mastodon** | ✅ | — | 500-char limit, 10 hashtags max |

---

## Features

### AI & Agent Pipeline
- **Autonomous 30-day content calendars** — Strategist plans posts across all platforms with content-pillar distribution (educational, promotional, engagement, trending, UGC)
- **Multi-language content generation** — Set `targetLocale` on any plan to generate content in a target language (es-MX, fr-FR, pt-BR, etc.)
- **A/B content testing** — Generate two variants per post, auto-promote the winner based on engagement rate
- **Comment/DM auto-reply** — Fourth agent monitors inboxes and replies in brand voice; escalates complaints, legal queries, and press inquiries to humans
- **Competitor analysis** — MCP tool fetches competitor post patterns; fed into the strategist as a differentiation signal
- **Brand voice drift detection** — After each review pass, measures semantic distance between the generated post and Qdrant brand vectors; logs an alert when drift exceeds a configurable threshold
- **Closed feedback loop** — Engagement analytics adjust copywriter tone weighting and tighten reviewer thresholds, not just inform planning

### Content & Publishing
- **Platform-aware formatter** — Every post passes through a formatter before publishing; enforces character limits, hashtag placement, and markup mode per platform
- **Thread & carousel support** — Multi-segment posts stored in a `segments` column; copywriter outputs segmented arrays for Twitter threads and Instagram carousels
- **Blog/RSS repurposing** — Accept a URL, extract the article, and reformat it as platform-specific posts using the brand-ingestion pipeline

### Product & Dashboard
- **HITL review queue** — Inline edit, approve, bulk approve, veto with reason, or silence the agent. Filterable by brand, platform, and content type
- **Campaign grouping** — Link multiple marketing plans under a campaign with goals, a budget cap, and a rollup analytics view
- **Webhook integrations** — Push `post_published`, `post_failed`, and `plan_ready` events to Slack, Discord, email, or any URL
- **Team & RBAC** — Invite team members with scoped stage access (plan_review | hitl | legal_review | analytics_only), per-brand or org-wide. Built on a `workflow_participants` table with unified `activity_events` audit log
- **White-label client reports** — CSV export of plan and brand performance, scoped to Agency tier and above
- **Agent log viewer** — Per-agent log stream surfaced in the dashboard; shows reviewer passes, rewrites, failures, and brand drift alerts

### Platform & Security
- **Brand memory** — Qdrant vector store with per-brand collections, always filtered by `brandProfileId` for strict tenant isolation
- **Incremental re-ingestion** — Diff-based brand update that only re-embeds changed chunks and tombstones removed ones
- **Anti shadow-ban jitter** — ±3-minute random offset applied to every scheduled post
- **Encrypted OAuth tokens** — AES-256-GCM with auto-refresh before expiry
- **Guardrails** — Per-org negative prompts and sensitive-event blackout windows prepended to every agent system prompt
- **IP rotation** — Shadow-ban protection via dedicated proxy pool (Scale tier)
- **Real-time overage alerts** — BullMQ notification jobs fired at 80% and 100% of monthly post quota

---

## Tech stack

| Layer | Technology |
|---|---|
| API | Express 4, Drizzle ORM (PostgreSQL), BullMQ (Redis) |
| Dashboard | Next.js 14 App Router, TanStack Query, Tailwind CSS |
| AI | Anthropic Claude (Sonnet + Haiku), Google Gemini 1.5 Pro, OpenAI DALL-E 3 |
| Vector store | Qdrant |
| Asset pipeline | Bannerbear, Cloudinary, AWS S3 / DigitalOcean Spaces |
| Auth | JWT (HTTP-only cookie) + OAuth 2.0 per platform |
| Billing | Stripe Subscriptions + Paystack + usage metering |
| Monorepo | Turborepo + pnpm workspaces |

---

## Monorepo structure

```
apps/
  api/          Express API — routes, workers, MCP server, agent services
  dashboard/    Next.js dashboard — brands, plans, accounts, review queue, analytics
packages/
  types/        Shared TypeScript types + PLAN_TIER_CONFIGS
  config/       Shared Zod schemas + product config
```

---

## Getting started

### Prerequisites

- Node.js ≥ 20, pnpm ≥ 9
- PostgreSQL, Redis, Qdrant running (or use the Docker Compose files)

### 1. Clone and install

```bash
git clone <repo>
cd anthyx
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Fill in DATABASE_URL, REDIS_URL, QDRANT_URL, API keys, OAuth credentials, Stripe keys
```

### 3. Start infrastructure

```bash
docker compose up -d   # postgres, redis, qdrant
```

### 4. Run migrations

```bash
pnpm db:migrate
```

### 5. Start dev servers

```bash
pnpm dev   # starts api (port 4000) + dashboard (port 3000) in parallel
```

---

## Environment variables

See [.env.example](.env.example) for the full list. Key groups:

| Group | Variables |
|---|---|
| Database | `DATABASE_URL`, `REDIS_URL`, `QDRANT_URL` |
| AI / LLM | `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY` |
| Social OAuth | `TWITTER_CLIENT_ID/SECRET`, `INSTAGRAM_APP_ID/SECRET`, `LINKEDIN_CLIENT_ID/SECRET`, `FACEBOOK_APP_ID/SECRET`, `TELEGRAM_BOT_TOKEN`, `TIKTOK_CLIENT_KEY/SECRET`, `DISCORD_BOT_TOKEN`, `REDDIT_CLIENT_ID/SECRET`, `BLUESKY_IDENTIFIER/PASSWORD` |
| Assets | `BANNERBEAR_API_KEY`, `CLOUDINARY_*`, `AWS_*` / `DO_SPACES_*` |
| Security | `JWT_SECRET`, `TOKEN_ENCRYPTION_KEY`, `NEXTAUTH_SECRET` |
| Billing | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PAYSTACK_SECRET_KEY`, Stripe/Paystack Price IDs per tier |
| Agent | `BRAND_DRIFT_THRESHOLD` (default 0.35), `GEMINI_STRATEGIST_MODEL` |

---

## Billing tiers

| Tier | Price | Brands | Posts/mo | Team seats | Key unlocks |
|---|---|---|---|---|---|
| Sandbox | Free | 1 | 15 | 1 | HITL, brand ingestion |
| Starter | $49/mo | 1 | 120 | 1 | Autonomous scheduling, guardrails |
| Growth | $149/mo | 3 | 500 | 3 | Feedback loop, AI asset generation |
| Agency | $399/mo | 15 | 2,500 | 10 | IP rotation, white-label reports, RBAC |
| Scale | $999/mo | Unlimited | 10,000 | Unlimited | Full platform access |
| Enterprise | Custom | Unlimited | Unlimited | Unlimited | SLA, dedicated support |

All paid tiers support usage-based overage ($0.04/post, $8/account, $25/brand).

---

## API overview

| Method | Path | Description |
|---|---|---|
| POST | `/v1/auth/login` | Authenticate and receive session cookie |
| GET/POST | `/v1/brands` | List / create brand profiles |
| POST | `/v1/brands/:id/ingest` | Trigger brand document ingestion |
| GET/POST | `/v1/agents` | List / create agent personas |
| GET | `/v1/agents/:id/logs` | Stream agent action logs |
| GET/POST | `/v1/plans` | List / generate marketing plans |
| GET | `/v1/posts/review` | HITL queue (filterable by brand, platform, content type) |
| POST | `/v1/posts/:id/approve` | Approve and schedule a post |
| POST | `/v1/posts/:id/veto` | Veto with reason |
| POST | `/v1/posts/batch-approve` | Bulk approve a filtered selection |
| POST | `/v1/posts/:id/ab-test` | Generate A/B variant pair |
| POST | `/v1/repurpose/blog` | Repurpose a blog URL into social posts |
| GET/POST | `/v1/campaigns` | Campaign CRUD |
| GET | `/v1/campaigns/:id/analytics` | Campaign rollup analytics |
| GET/POST | `/v1/team` | Team participant management |
| POST | `/v1/team/invite` | Issue a signed 7-day invite token |
| POST | `/v1/team/accept` | Accept invite and create participant row |
| GET/POST | `/v1/webhooks` | Webhook endpoint CRUD |
| GET | `/v1/reports/plan/:planId` | CSV plan performance report (Agency+) |
| GET | `/v1/reports/brand/:brandId` | CSV brand performance report (Agency+) |
| GET/POST | `/v1/accounts` | Social account OAuth connect/disconnect |
| GET | `/v1/analytics` | Cross-brand engagement analytics |
| GET/POST | `/v1/billing` | Subscription management |

---

## Production deployment

```bash
docker compose -f docker-compose.prod.yml up -d
```

The production compose file runs `apps/api` and `apps/dashboard` as separate containers behind a shared network.

---

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start all apps in development mode |
| `pnpm build` | Build all apps and packages |
| `pnpm test` | Run unit tests |
| `pnpm test:integration` | Run integration tests |
| `pnpm db:migrate` | Apply pending database migrations |
| `pnpm db:generate` | Generate migration files from schema changes |
| `pnpm db:studio` | Open Drizzle Studio |
