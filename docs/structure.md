# Anthyx — Project Structure

> **Stack:** Express 4 · TypeScript · Next.js 14 · Drizzle ORM · BullMQ · Qdrant · Gemini  
> **Pattern:** Turborepo monorepo · pnpm workspaces · standalone services + shared packages  
> **Last updated:** April 2026

---

## Quick Reference

| Layer | App / Package | Purpose |
|---|---|---|
| API + In-process Workers | `apps/api` | Express server, MCP registration, BullMQ workers (plan/content/post/analytics/ingestor/notification/overage) |
| Standalone Ingestor | `services/ingestor` | Brand ingestion pipeline — BullMQ consumer on `anthyx-ingestor` queue |
| Standalone Agent Service | `services/agent` | Plan + content generation workers — BullMQ consumers (disabled in compose until stable) |
| Standalone MCP Server | `services/mcp` | fastmcp SSE server on port 3100 — brand context, scheduling, image tools |
| Dashboard | `frontend/` | Next.js 14, HITL review queue, billing, analytics |
| Shared types | `packages/types` | TypeScript interfaces shared across all services |
| Shared config | `packages/config` | Zod schemas, shared constants, product config, credit costs |
| Queue contracts | `packages/queue-contracts` | BullMQ job payload types shared between API and Node.js services |

---

## Full Structure

```
anthyx/
│
│  # ── Monorepo config ─────────────────────────────────────────────
├── turbo.json                     # Turborepo pipeline definitions
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── tsconfig.base.json
├── package.json                   # Root scripts: dev, build, test
├── docker-compose.yml             # Local dev: api, worker, mcp, ingestor, postgres, redis, qdrant
├── docker-compose.prod.yml        # Production container overrides
├── .env.example
│
│  # ── Docs ──────────────────────────────────────────────────────
├── docs/
│   ├── structure.md               # This file
│   ├── technical.md               # Full technical reference
│   └── StackUpdate.md             # Architecture migration guide
│
│  # ── Apps (monolithic Express + workers — current primary backend) ──────
├── apps/
│   │
│   ├── api/                       # Express API + Workers
│   │   ├── Dockerfile
│   │   ├── drizzle.config.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts           # Express app entry point, route registration
│   │       │
│   │       ├── db/
│   │       │   ├── client.ts      # Drizzle pg pool
│   │       │   ├── schema.ts      # Single source of truth for all DB tables + enums
│   │       │   └── seed.ts        # Seed plan tier rows
│   │       │
│   │       ├── middleware/
│   │       │   ├── auth.ts        # JWT cookie validation + issueToken()
│   │       │   ├── plan-limits.ts # requireLimit() — 402 on quota breach
│   │       │   └── validate.ts    # Zod body validation middleware
│   │       │
│   │       ├── mcp/
│   │       │   ├── server.ts      # MCP SSE endpoint registration (in-process)
│   │       │   └── tools/
│   │       │       ├── competitor-analysis.ts         # Fetches + summarises competitor post patterns
│   │       │       ├── generate-image-asset.ts        # DALL-E 3 asset generation tool
│   │       │       ├── read-engagement-analytics.ts
│   │       │       ├── retrieve-brand-context.ts
│   │       │       ├── retrieve-brand-rules.ts
│   │       │       ├── retrieve-brand-voice.ts
│   │       │       ├── retrieve-diet-instructions.ts
│   │       │       ├── schedule-post.ts
│   │       │       └── web-search-trends.ts
│   │       │
│   │       ├── queue/
│   │       │   ├── client.ts      # BullMQ queue instances (post, plan, content, asset, analytics, notification)
│   │       │   └── jobs.ts        # schedulePostJob(), cancelPostJob()
│   │       │
│   │       ├── routes/
│   │       │   ├── accounts.ts    # /v1/accounts — OAuth connect/disconnect
│   │       │   ├── agents.ts      # /v1/agents — CRUD + /logs endpoint
│   │       │   ├── analytics.ts   # /v1/analytics — cross-brand engagement data
│   │       │   ├── auth.ts        # /v1/auth — login, register, refresh
│   │       │   ├── billing.ts     # /v1/billing — Stripe + Paystack subscriptions
│   │       │   ├── brands.ts      # /v1/brands — CRUD + /ingest
│   │       │   ├── campaigns.ts   # /v1/campaigns — CRUD + rollup analytics
│   │       │   ├── guardrails.ts  # /v1/guardrails — org prohibitions + blackouts
│   │       │   ├── plans.ts       # /v1/plans — generate, approve, content gen
│   │       │   ├── posts.ts       # /v1/posts — HITL approve/veto/bulk/A-B test
│   │       │   ├── reports.ts     # /v1/reports — CSV export (Agency+ only)
│   │       │   ├── repurpose.ts   # /v1/repurpose/blog — URL → social posts
│   │       │   ├── team.ts        # /v1/team — invite, accept, PATCH, DELETE
│   │       │   └── webhooks.ts    # /v1/webhooks — endpoint CRUD
│   │       │
│   │       ├── services/
│   │       │   ├── agent/
│   │       │   │   ├── ab-tester.ts         # Generate A/B variants + auto-promote winner
│   │       │   │   ├── auto-reply.ts        # Comment/DM reply agent (fourth agent)
│   │       │   │   ├── brand-context.ts     # Qdrant RAG retrieval helper
│   │       │   │   ├── copywriter.ts        # Copywriter agent (Gemini Flash)
│   │       │   │   ├── guardrails.ts        # System prompt injection of prohibitions/blackouts
│   │       │   │   ├── llm-client.ts        # generateWithFallback() — Gemini → Claude fallback
│   │       │   │   ├── logger.ts            # logAgentAction() → agentLogs + activityEvents
│   │       │   │   ├── orchestrator.ts      # Parallel content gen pipeline + drift detection
│   │       │   │   ├── prompt-builder.ts    # Per-platform PLATFORM_RULES for all 14 platforms
│   │       │   │   ├── reviewer.ts          # Reviewer agent (Gemini Flash-8B, adversarial)
│   │       │   │   └── strategist.ts        # Strategist agent (Gemini Pro, structured output)
│   │       │   │
│   │       │   ├── analytics/
│   │       │   │   └── scorer.ts            # computeVoicePerformance() + classifyVoices()
│   │       │   │
│   │       │   ├── assets/
│   │       │   │   ├── ai-generator.ts      # DALL-E 3 image generation
│   │       │   │   ├── cdn.ts               # Cloudinary / S3 upload
│   │       │   │   ├── generator.ts         # Asset pipeline orchestrator
│   │       │   │   └── template-renderer.ts # Bannerbear template rendering
│   │       │   │
│   │       │   ├── billing/
│   │       │   │   ├── limits.ts            # PlanLimitError + requireLimit() logic
│   │       │   │   ├── overage.ts           # Calculate + invoice overage at period end
│   │       │   │   ├── paystack.ts          # Paystack subscription + webhook handler
│   │       │   │   ├── stripe.ts            # Stripe webhook handler + subscription sync
│   │       │   │   └── usage-tracker.ts     # incrementPost() + 80%/100% quota alerts
│   │       │   │
│   │       │   ├── brand-ingestion/
│   │       │   │   ├── embedder.ts          # Qdrant upsert + incrementalIngestBrandDocument()
│   │       │   │   ├── extractor.ts         # Voice/tone/color extraction (Gemini Flash)
│   │       │   │   └── parser.ts            # PDF, Markdown, URL → text chunks
│   │       │   │
│   │       │   ├── oauth-proxy/
│   │       │   │   ├── crypto.ts            # AES-256-GCM token encrypt/decrypt
│   │       │   │   ├── index.ts             # Token fetch + auto-refresh orchestrator
│   │       │   │   └── refreshers.ts        # Per-platform token refresh functions
│   │       │   │
│   │       │   ├── posting/
│   │       │   │   ├── executor.ts          # publishToplatform() — formatter → publisher
│   │       │   │   ├── formatter.ts         # formatPostForPlatform() — all 14 platforms
│   │       │   │   ├── proxy-router.ts      # Per-org proxy pool + user-agent rotation
│   │       │   │   └── social-mcp.ts        # publishPost() + fetchEngagementData() per platform
│   │       │   │
│   │       │   └── repurpose/
│   │       │       └── blog-repurposer.ts   # URL fetch → article extract → social posts
│   │       │
│   │       └── workers/
│   │           ├── index.ts                 # Worker process entry point
│   │           ├── analytics.worker.ts      # Polls published posts for engagement data
│   │           ├── content.worker.ts        # Runs copywriter + reviewer per post
│   │           ├── ingestor.worker.ts       # Brand ingestion — in-process BullMQ consumer
│   │           ├── notification.worker.ts   # Fires webhooks + usage alerts
│   │           ├── overage.worker.ts        # Cron: calculates + invoices monthly overage
│   │           ├── plan.worker.ts           # Runs strategist → seeds draft posts
│   │           └── post.worker.ts           # Executes scheduled posts via executor
│
│  # ── Standalone Services (polyglot extraction — in progress) ────────────
├── services/
│   │
│   ├── ingestor/               # Node.js — brand ingestion pipeline
│   │   ├── src/
│   │   │   ├── worker.ts       # BullMQ consumer entry — queue: anthyx-ingestor
│   │   │   ├── parser.ts       # pdf-parse, cheerio, fs
│   │   │   ├── extractor.ts    # Gemini Flash — brand data extraction
│   │   │   ├── embedder.ts     # OpenAI embeddings → Qdrant upsert
│   │   │   ├── db.ts           # Drizzle client
│   │   │   └── schema.ts       # DB schema reference (read-only)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── Dockerfile
│   │
│   ├── agent/                  # Node.js — plan + content generation workers
│   │   │                       # NOTE: disabled in docker-compose; competes with apps/api workers
│   │   ├── src/
│   │   │   ├── index.ts        # Entry: starts plan.worker + content.worker
│   │   │   ├── strategist.ts   # Gemini Pro — two-phase plan generation (tool-call → format)
│   │   │   ├── copywriter.ts   # Gemini Flash — content generation
│   │   │   ├── reviewer.ts     # Gemini Flash-8B — adversarial gate
│   │   │   ├── orchestrator.ts # Copywriter → Reviewer loop with retry
│   │   │   ├── brand-context.ts
│   │   │   ├── prompt-builder.ts
│   │   │   ├── guardrails.ts
│   │   │   ├── logger.ts
│   │   │   ├── db.ts
│   │   │   ├── redis.ts
│   │   │   ├── schema.ts
│   │   │   ├── schema-analytics.ts
│   │   │   ├── tools/
│   │   │   │   ├── read-engagement-analytics.ts   # Direct DB read
│   │   │   │   └── web-search-trends.ts           # Brave/Tavily search
│   │   │   └── workers/
│   │   │       ├── plan.worker.ts     # BullMQ: anthyx-plan-generation
│   │   │       └── content.worker.ts  # BullMQ: anthyx-content-generation
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── Dockerfile
│   │
│   └── mcp/                    # Node.js — fastmcp SSE server (port 3100)
│       ├── src/
│       │   ├── index.ts        # fastmcp server entry
│       │   ├── db.ts
│       │   ├── qdrant.ts
│       │   ├── redis.ts
│       │   ├── schema.ts
│       │   └── tools/
│       │       ├── retrieve-brand-context.ts
│       │       ├── retrieve-brand-voice.ts
│       │       ├── retrieve-brand-rules.ts
│       │       ├── retrieve-diet-instructions.ts
│       │       ├── read-engagement-analytics.ts
│       │       ├── schedule-post.ts
│       │       ├── web-search-trends.ts
│       │       └── generate-image-asset.ts
│       ├── package.json
│       ├── tsconfig.json
│       └── Dockerfile
│
│  # ── Frontend ─────────────────────────────────────────────────────────
├── frontend/                   # Next.js 14 App Router (moved from apps/dashboard)
│   └── src/app/(dashboard)/dashboard/
│       ├── page.tsx                     # Overview / home
│       ├── accounts/                    # Social account OAuth management
│       ├── agents/                      # Agent CRUD + log viewer
│       │   └── [id]/page.tsx            # Per-agent log stream
│       ├── analytics/                   # Cross-brand analytics
│       ├── billing/                     # Subscription + usage
│       ├── brands/                      # Brand profiles + ingestion
│       │   └── [id]/
│       │       ├── page.tsx
│       │       └── ingest/page.tsx
│       ├── campaigns/                   # Campaign CRUD + rollup view
│       │   └── [id]/page.tsx
│       ├── plans/                       # Marketing plan list + detail
│       │   └── [id]/page.tsx
│       ├── repurpose/                   # Blog URL → social posts
│       ├── review/                      # HITL review queue (filter + bulk actions)
│       ├── settings/                    # Org settings + guardrails
│       ├── team/                        # Team invite + RBAC management
│       └── webhooks/                    # Webhook endpoint CRUD
│
├── packages/
│   ├── types/
│   │   └── src/
│   │       ├── index.ts         # Re-exports all types
│   │       ├── agents.ts        # Agent, ReviewerOutput, CopywriterOutput, etc.
│   │       ├── billing.ts       # Subscription, PlanTier, UsageRecord types
│   │       ├── plans.ts         # GeneratedPlanItem, MarketingPlan types
│   │       └── platforms.ts     # Platform union type (14 values)
│   │
│   ├── config/
│   │   └── src/
│   │       ├── index.ts         # Re-exports all schemas
│   │       ├── credits.ts       # CREDIT_COSTS — TEXT_POST, AI_IMAGE, PLAN_GENERATION, etc.
│   │       ├── product.ts       # productConfig — name, limits, model IDs
│   │       └── schemas.ts       # Zod schemas: post, plan, agent, billing, brand extraction
│   │
│   └── queue-contracts/
│       └── src/
│           ├── index.ts         # Re-exports all payloads
│           ├── agent.ts         # PlanJobPayload, ContentJobPayload
│           ├── ingest.ts        # IngestBrandPayload
│           └── post.ts          # PostExecutionPayload
```

---

## Database Tables (schema.ts)

| Table | Purpose |
|---|---|
| `organizations` | Multi-tenant root; holds org-level guardrails |
| `users` | Auth users with org membership |
| `brandProfiles` | Brand identity, Qdrant collection ID, ingest status |
| `agents` | Named personas with diet instructions and silence controls |
| `socialAccounts` | OAuth tokens (AES-256-GCM) per platform per agent |
| `campaigns` | Groups of plans with shared goals and budget cap |
| `marketingPlans` | 30-day content calendars; links to campaign and agent |
| `scheduledPosts` | Individual posts with status state machine |
| `postAnalytics` | Engagement metrics per published post |
| `agentLogs` | Per-agent action log (reviewer pass/fail, drift alerts) |
| `activityEvents` | Unified audit log for both agent and human actions |
| `abTests` | A/B variant pairs with winner promotion tracking |
| `webhookEndpoints` | User-configured webhook URLs with HMAC secrets |
| `workflowParticipants` | RBAC — user → stage → brand/agent access rules |
| `planTiers` | Tier config (limits, feature flags, overage pricing) |
| `subscriptions` | Active subscription per org (Stripe + Paystack) |
| `usageRecords` | Monthly usage tracking with overage accumulation |
