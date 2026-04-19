# Anthyx

**Autonomous multi-agent marketing platform.** Anthyx ingests a brand's identity — voice, tone, values, colors — and uses a three-agent AI pipeline to autonomously generate, schedule, and publish content across social platforms at scale.

---

## How it works

```
Brand Profile (ingested) → Strategist → Copywriter → Reviewer → Scheduled Post
```

| Agent | Model | Role |
|---|---|---|
| **Strategist** | Gemini 1.5 Pro (agentic) | Generates a 30-day content calendar using brand context, live trend search, and past engagement analytics |
| **Copywriter** | Claude Sonnet / Gemini fallback | Writes the final post copy, hashtags, and media prompt for each plan item |
| **Reviewer** | Claude Haiku (adversarial) | Rejects or approves drafts against brand guardrails; up to 2 automatic retries before escalating to HITL |

---

## Features

- **Autonomous content calendar** — Strategist plans posts across platforms with content-pillar distribution (educational, promotional, engagement, trending, UGC)
- **Multi-platform publishing** — X, Instagram, LinkedIn, Facebook, Telegram, TikTok with platform-specific constraints enforced at generation time
- **Brand memory** — Qdrant vector store holds per-brand voice, tone, and style; retrieved semantically on every generation call
- **Guardrails** — Per-org negative prompts and sensitive-event blackout windows prepended to every agent prompt
- **HITL review queue** — Inline edit, approve, batch approve, veto with reason, or silence the agent entirely
- **AI asset generation** — DALL-E 3 for image generation; Bannerbear for templated creative assets
- **Anti shadow-ban jitter** — ±3 minute random offset applied to every scheduled post
- **Encrypted OAuth tokens** — AES-256-GCM encryption with auto-refresh before expiry
- **Stripe billing** — 6 tiers (Sandbox → Enterprise) with usage-based overage for posts, accounts, and brands

---

## Tech stack

| Layer | Technology |
|---|---|
| API | Express 4, Drizzle ORM (PostgreSQL), BullMQ (Redis) |
| Dashboard | Next.js 14 App Router, TanStack Query, Tailwind CSS |
| AI | Anthropic Claude (Sonnet + Haiku), Google Gemini (1.5 Pro), OpenAI DALL-E 3 |
| Vector store | Qdrant |
| Asset pipeline | Bannerbear, Cloudinary, AWS S3 / DigitalOcean Spaces |
| Auth | JWT + OAuth 2.0 (per-platform) |
| Billing | Stripe Subscriptions + usage metering |
| Monorepo | Turborepo + pnpm |

---

## Monorepo structure

```
apps/
  api/          Express API — routes, workers, MCP server, agent services
  dashboard/    Next.js dashboard — brands, plans, accounts, analytics
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
| Social OAuth | `TWITTER_CLIENT_ID/SECRET`, `INSTAGRAM_APP_ID/SECRET`, `LINKEDIN_CLIENT_ID/SECRET`, `TELEGRAM_BOT_TOKEN` |
| Assets | `BANNERBEAR_API_KEY`, `CLOUDINARY_*`, `AWS_*` / `DO_SPACES_*` |
| Security | `JWT_SECRET`, `TOKEN_ENCRYPTION_KEY`, `NEXTAUTH_SECRET` |
| Billing | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, Stripe Price IDs per tier |

---

## Billing tiers

| Tier | Price | Brands | Posts/mo |
|---|---|---|---|
| Sandbox | Free | 1 | 15 |
| Starter | $49/mo | 1 | 120 |
| Growth | $149/mo | 3 | 500 |
| Agency | $399/mo | 15 | 2,500 |
| Scale | $999/mo | Unlimited | 10,000 |
| Enterprise | Custom | Unlimited | Unlimited |

All paid tiers support usage-based overage ($0.04/post, $8/account, $25/brand).

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
