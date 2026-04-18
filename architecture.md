# Anthyx — Architecture & File Structure

## Overview

Anthyx is a multi-tenant AI social media management SaaS. A Turborepo monorepo with pnpm workspaces organizes all code into `apps/`, `services/`, `packages/`, and `frontend/`. Each deployable unit is independently containerizable.

---

## Deployment Topology

```
                        ┌─────────────────────────────────────┐
                        │           Load Balancer / CDN        │
                        └────────┬─────────────┬──────────────┘
                                 │             │
                    ┌────────────▼──┐   ┌──────▼──────────────┐
                    │  frontend/    │   │   apps/api           │
                    │  Next.js :3000│   │   Express :4000      │
                    └───────────────┘   └──────┬───────────────┘
                                               │  HTTP / queues
              ┌────────────────────────────────┼────────────────────┐
              │                                │                    │
   ┌──────────▼──────┐          ┌──────────────▼──┐   ┌────────────▼────┐
   │ services/mcp    │          │services/agent    │   │services/ingestor│
   │ fastmcp SSE:3100│          │BullMQ workers    │   │BullMQ worker    │
   └──────────┬──────┘          └──────────────┬──┘   └────────────┬────┘
              │                                │                    │
              └──────────────────┬─────────────┘                    │
                                 │                                  │
                    ┌────────────▼──────────────────────────────────▼──┐
                    │              Shared Infrastructure               │
                    │   PostgreSQL │ Redis (BullMQ) │ Qdrant (vectors) │
                    └──────────────────────────────────────────────────┘
```

---

## Monorepo Structure

```
anthyx/
├── apps/
│   ├── api/                        ← Express REST API (primary backend)
│   │   └── src/
│   │       ├── db/
│   │       │   ├── client.ts       ← Drizzle + pg pool
│   │       │   ├── schema.ts       ← Single source of truth for DB schema
│   │       │   └── seed.ts
│   │       ├── middleware/
│   │       │   ├── auth.ts         ← JWT bearer token validation
│   │       │   ├── plan-limits.ts  ← requireLimit() Express middleware (402 on breach)
│   │       │   └── validate.ts     ← Zod body validation
│   │       ├── routes/
│   │       │   ├── auth.ts         ← /v1/auth (login, register, refresh)
│   │       │   ├── brands.ts       ← /v1/brands + /ingest (dispatches to ingestor queue)
│   │       │   ├── agents.ts       ← /v1/agents (CRUD)
│   │       │   ├── plans.ts        ← /v1/plans (create, approve, generate)
│   │       │   ├── posts.ts        ← /v1/posts (HITL approve/veto)
│   │       │   ├── accounts.ts     ← /v1/accounts (OAuth connect/disconnect)
│   │       │   ├── billing.ts      ← /v1/billing (Stripe + Paystack subscriptions)
│   │       │   ├── analytics.ts    ← /v1/analytics
│   │       │   └── guardrails.ts   ← /v1/guardrails (prohibitions, blackouts)
│   │       ├── services/
│   │       │   ├── agent/          ← Strategist/Copywriter/Reviewer (Anthropic — legacy)
│   │       │   ├── analytics/      ← scorer.ts (engagement rate calculator)
│   │       │   ├── assets/         ← BannerBear template + DALL-E AI generation + CDN
│   │       │   ├── billing/
│   │       │   │   ├── stripe.ts   ← Stripe subscriptions + webhooks
│   │       │   │   ├── paystack.ts ← Paystack subscriptions + webhooks
│   │       │   │   ├── limits.ts   ← PlanLimitsEnforcer (credit/seat enforcement)
│   │       │   │   ├── overage.ts  ← Nightly overage invoice calculator
│   │       │   │   └── usage-tracker.ts
│   │       │   ├── brand-ingestion/← Parser + Extractor (Anthropic) + Embedder (kept for legacy)
│   │       │   ├── oauth-proxy/    ← AES-256-GCM token encryption + platform refreshers
│   │       │   └── posting/
│   │       │       ├── social-mcp.ts ← Unified publisher (all platforms)
│   │       │       └── executor.ts  ← Post execution orchestrator
│   │       ├── queue/
│   │       │   ├── client.ts       ← BullMQ queue definitions (6 queues)
│   │       │   └── jobs.ts         ← Helper: schedulePostJob, queuePlanGeneration, etc.
│   │       ├── workers/            ← In-process BullMQ workers (still active until services/agent stable)
│   │       │   ├── plan.worker.ts
│   │       │   ├── content.worker.ts
│   │       │   ├── post.worker.ts
│   │       │   ├── analytics.worker.ts
│   │       │   └── overage.worker.ts (nightly cron via node-cron)
│   │       └── mcp/
│   │           └── server.ts       ← SSEServerTransport (legacy, kept while services/mcp stabilizes)
│   │
│   └── dashboard/                  ← Next.js 14 dashboard (original, kept in sync with frontend/)
│       └── src/app/
│           ├── (auth)/             ← login, register
│           └── (dashboard)/dashboard/
│               ├── brands/         ← brand profiles + ingest upload
│               ├── agents/         ← persona management
│               ├── plans/          ← marketing calendar
│               ├── accounts/       ← social account OAuth
│               ├── billing/        ← usage meters + plan upgrade + overage cap
│               └── analytics/      ← engagement charts + voice performance
│
├── frontend/                       ← Standalone Next.js (copy of dashboard, deployable alone)
│   └── (same structure as apps/dashboard)
│
├── services/
│   ├── mcp/                        ← Standalone fastmcp SSE server
│   │   └── src/
│   │       ├── index.ts            ← FastMCP server, 8 tools registered, SSE on :3100
│   │       ├── db.ts               ← Drizzle client (reads brand profiles, agents, posts)
│   │       ├── redis.ts            ← IORedis + postExecutionQueue
│   │       ├── qdrant.ts           ← QdrantClient + embed() via Gemini text-embedding-004
│   │       ├── schema.ts           ← Copied schema subset (read-only use)
│   │       └── tools/
│   │           ├── retrieve-brand-context.ts  ← Qdrant semantic search + brand profile
│   │           ├── retrieve-brand-voice.ts    ← Voice rules / tone descriptors
│   │           ├── retrieve-brand-rules.ts    ← All brand guidelines combined
│   │           ├── retrieve-diet-instructions.ts ← Agent diet rules
│   │           ├── read-engagement-analytics.ts  ← Post performance classification
│   │           ├── schedule-post.ts           ← BullMQ job dispatch with ±3min jitter
│   │           ├── web-search-trends.ts       ← Tavily API or stub fallback
│   │           └── generate-image-asset.ts    ← DALL-E 3 image generation
│   │
│   ├── ingestor/                   ← Standalone brand document ingestor
│   │   └── src/
│   │       ├── worker.ts           ← BullMQ worker on "anthyx-ingestor" queue
│   │       ├── parser.ts           ← PDF / Markdown / URL → text
│   │       ├── extractor.ts        ← Gemini Flash → structured BrandExtraction JSON
│   │       ├── embedder.ts         ← Gemini text-embedding-004 → Qdrant upsert
│   │       ├── db.ts               ← Drizzle (updates brand_profiles after ingest)
│   │       └── schema.ts           ← Minimal schema (organizations + brandProfiles)
│   │
│   └── agent/                      ← Standalone AI agent service (Gemini-powered)
│       └── src/
│           ├── index.ts            ← Starts plan + content workers
│           ├── strategist.ts       ← Gemini 1.5 Pro + function calling agentic loop
│           ├── copywriter.ts       ← Gemini 1.5 Flash → post content + hashtags
│           ├── reviewer.ts         ← Gemini 1.5 Flash-8B → compliance gate (adversarial)
│           ├── orchestrator.ts     ← Copywriter → Reviewer loop (max 2 retries)
│           ├── brand-context.ts    ← Qdrant brand voice retrieval (Gemini embeddings)
│           ├── guardrails.ts       ← Org prohibitions + active blackout periods
│           ├── prompt-builder.ts   ← Platform-specific character/tone constraints
│           ├── logger.ts           ← agent_logs DB insert
│           ├── db.ts / redis.ts / schema.ts / schema-analytics.ts
│           ├── tools/
│           │   ├── web-search-trends.ts      ← Tavily (same as mcp service)
│           │   └── read-engagement-analytics.ts ← DB analytics for strategist context
│           └── workers/
│               ├── plan.worker.ts    ← Consumes "anthyx-plan-generation" queue
│               └── content.worker.ts ← Consumes "anthyx-content-generation" queue
│
└── packages/
    ├── config/                     ← Shared Zod schemas + product config + credit costs
    │   └── src/
    │       ├── schemas.ts          ← BrandExtractionSchema, CopywriterOutputSchema, etc.
    │       ├── product.ts          ← productConfig (limits, thresholds, retry counts)
    │       └── credits.ts          ← CREDIT_COSTS (TEXT_POST=1, AI_IMAGE=5, etc.)
    ├── types/                      ← Shared TypeScript interfaces (no runtime code)
    │   └── src/
    │       ├── agents.ts           ← Agent, BrandProfile, GeneratedPlanItem, CopywriterOutput
    │       ├── plans.ts            ← MarketingPlan, ScheduledPost, PostAnalytics
    │       ├── platforms.ts        ← Platform union type
    │       └── billing.ts          ← PlanTier, PLAN_TIER_CONFIGS
    └── queue-contracts/            ← Typed BullMQ job payload interfaces
        └── src/
            ├── ingest.ts           ← IngestBrandPayload
            ├── agent.ts            ← PlanJobPayload, ContentJobPayload, AnalyticsJobPayload
            └── post.ts             ← PostExecutionPayload
```

---

## Data Flow

### Brand Ingest
```
POST /v1/brands/:id/ingest
  → ingestorQueue.add("ingest-brand", payload)   [HTTP 202, non-blocking]
  → services/ingestor worker picks up job
  → parser.ts extracts text (PDF/URL/MD)
  → extractor.ts (Gemini Flash) → BrandExtraction JSON
  → embedder.ts → Qdrant upsert + DB update
```

### Marketing Plan Generation
```
POST /v1/plans/:id/generate
  → planGenerationQueue.add("generate-plan", payload)
  → services/agent plan.worker.ts
  → strategist.ts (Gemini Pro + function calling)
      [tools: retrieve_brand_context, web_search_trends, read_engagement_analytics]
  → 30 ScheduledPost rows inserted (status: "draft")
  → contentGenerationQueue.add("generate-content", { planId })
  → services/agent content.worker.ts
  → orchestrator.ts: for each draft post:
      → copywriter.ts (Gemini Flash) → draft content
      → reviewer.ts (Gemini Flash-8B) → pass/fail/rewrite
      → max 2 rewrite retries, then fail
  → posts become status: "pending_review"
```

### HITL Approval → Publishing
```
Dashboard: approve post
  → POST /v1/posts/:id/approve
  → services/mcp/tools/schedule-post.ts dispatches BullMQ job with ±3min jitter
  → apps/api post.worker.ts
  → posting/executor.ts → social-mcp.ts → platform API
  → analytics.worker.ts fetches metrics 30min post-publish
```

### Billing
```
Stripe:   POST /billing/subscribe → checkout session → webhook → subscription DB row
Paystack: POST /billing/subscribe → transaction initialize → webhook → subscription DB row
Nightly:  overage.worker.ts (node-cron 2am) → calculateAndInvoiceOverage()
```

---

## BullMQ Queues

| Queue name                  | Producer         | Consumer                          |
|-----------------------------|------------------|-----------------------------------|
| `anthyx-ingestor`           | brands route     | services/ingestor worker          |
| `anthyx-plan-generation`    | plans route      | services/agent plan.worker.ts     |
| `anthyx-content-generation` | plan worker      | services/agent content.worker.ts  |
| `anthyx-post-execution`     | schedule-post    | apps/api post.worker.ts           |
| `anthyx-analytics`          | post worker      | apps/api analytics.worker.ts      |
| `anthyx-asset-generation`   | plans route      | apps/api (not yet implemented)    |

---

## Database Schema Summary (PostgreSQL)

| Table               | Purpose                                              |
|---------------------|------------------------------------------------------|
| `organizations`     | Multi-tenant root. Holds global prohibitions, blackouts |
| `users`             | Members belonging to an org (owner/admin/member)     |
| `brand_profiles`    | Brand identity, voice traits, colors, Qdrant refs   |
| `agents`            | Personas with diet instructions and system overrides |
| `social_accounts`   | Connected platform accounts (encrypted OAuth tokens) |
| `marketing_plans`   | 30-day calendars linking agent → brand               |
| `scheduled_posts`   | Individual post instances (draft → published)        |
| `post_analytics`    | Engagement metrics per published post                |
| `agent_logs`        | Audit trail of all agent actions                     |
| `plan_tiers`        | Feature limits per tier (DB-driven config)           |
| `subscriptions`     | Billing state (Stripe + Paystack fields, tier, status)|
| `usage_records`     | Per-period usage for overage calculation             |

---

## Service Independence Assessment

**Can each service deploy independently?** Yes — here is what each needs:

| Service           | Needs                                       | Independent? |
|-------------------|---------------------------------------------|--------------|
| `apps/api`        | Postgres, Redis, env vars                   | ✅ Yes        |
| `frontend/`       | `NEXT_PUBLIC_API_URL` env var               | ✅ Yes        |
| `services/mcp`    | Postgres, Redis, Qdrant, `GEMINI_API_KEY`   | ✅ Yes        |
| `services/ingestor`| Postgres, Redis, Qdrant, `GEMINI_API_KEY`  | ✅ Yes        |
| `services/agent`  | Postgres, Redis, Qdrant, `GEMINI_API_KEY`   | ✅ Yes        |

All services share the same Postgres database and Redis instance but have **no direct HTTP dependencies on each other** — they communicate only via BullMQ queues and shared DB reads. This means:
- You can scale `services/agent` independently (more workers = more plan generations)
- You can deploy `services/ingestor` on a beefy machine for fast PDF processing
- `services/mcp` can run on a separate machine accessible only to the agent service
- `apps/api` remains thin and stateless — no LLM calls, no heavy processing

**What's not isolated yet:**
- `apps/api/src/workers/` — plan/content workers still run in-process. Once `services/agent` is confirmed stable, these can be removed from the API process.
- `apps/api/src/mcp/server.ts` — MCP SSE routes are still registered in Express. Can be removed once `services/mcp` is confirmed stable.
- `apps/dashboard` and `frontend/` are currently duplicated. Pick one as canonical and remove the other.

---

## Technology Stack

| Layer              | Technology                                      |
|--------------------|-------------------------------------------------|
| API Framework      | Express (Node.js)                               |
| Frontend           | Next.js 14, Tailwind CSS, next-auth v5          |
| Database           | PostgreSQL via Drizzle ORM                      |
| Queue              | BullMQ + Redis (IORedis)                        |
| Vector Store       | Qdrant (per-brand collections, tenant-isolated) |
| LLM — Strategist   | Gemini 1.5 Pro (function calling)               |
| LLM — Copywriter   | Gemini 1.5 Flash                                |
| LLM — Reviewer     | Gemini 1.5 Flash-8B                             |
| LLM — Extraction   | Gemini 1.5 Flash                                |
| Embeddings         | Gemini text-embedding-004 (768-dim)             |
| Image Generation   | DALL-E 3 (OpenAI)                               |
| Asset Templates    | BannerBear + Cloudinary CDN                     |
| Billing            | Stripe + Paystack (dual provider)               |
| Email              | Resend                                          |
| MCP Protocol       | fastmcp (SSE transport)                         |
| Monorepo           | Turborepo + pnpm workspaces                     |
| Auth (API)         | JWT (RS256 / HS256) + AES-256-GCM token storage |
| Auth (Dashboard)   | next-auth v5 Credentials provider              |
| Monitoring         | Sentry                                          |
