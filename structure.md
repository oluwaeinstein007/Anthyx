# Anthyx — Project Structure

> **Stack:** Express 4 · TypeScript · Next.js 14 · Drizzle ORM · BullMQ · Qdrant  
> **Pattern:** Turborepo monorepo · pnpm workspaces · two apps + two shared packages  
> **Last updated:** April 2026

---

## Quick Reference

| Layer | App / Package | Purpose |
|---|---|---|
| API + Workers + Agents | `apps/api` | Express server, agent pipeline, BullMQ workers, social posting |
| Dashboard | `apps/dashboard` (frontend/) | Next.js 14, HITL review queue, billing, analytics |
| Shared types | `packages/types` | TypeScript interfaces shared across both apps |
| Shared config | `packages/config` | Zod schemas, shared constants, product config |

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
├── docker-compose.yml             # Local dev: postgres, redis, qdrant
├── docker-compose.prod.yml        # Production container overrides
├── .env.example
│
│  # ── Docs ──────────────────────────────────────────────────────
├── README.md
├── technical.md                   # Full technical reference
├── architecture.md                # Architecture diagrams and file map
├── improvement.md                 # Feature backlog (all items completed)
│
│  # ── Apps ──────────────────────────────────────────────────────
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
│   │       │   ├── server.ts      # MCP SSE endpoint registration
│   │       │   └── tools/
│   │       │       ├── competitor-analysis.ts     # Fetches + summarises competitor post patterns
│   │       │       ├── generate-image-asset.ts    # DALL-E 3 asset generation tool
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
│   │       │   │   ├── copywriter.ts        # Copywriter agent (Claude Sonnet)
│   │       │   │   ├── guardrails.ts        # System prompt injection of prohibitions/blackouts
│   │       │   │   ├── llm-client.ts        # generateWithFallback() — Gemini → Claude
│   │       │   │   ├── logger.ts            # logAgentAction() → agentLogs + activityEvents
│   │       │   │   ├── orchestrator.ts      # Parallel content gen pipeline + drift detection
│   │       │   │   ├── prompt-builder.ts    # Per-platform PLATFORM_RULES for all 14 platforms
│   │       │   │   ├── reviewer.ts          # Reviewer agent (Claude Haiku, adversarial)
│   │       │   │   └── strategist.ts        # Strategist agent (Gemini, structured output)
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
│   │       │   │   ├── stripe.ts            # Stripe webhook handler + subscription sync
│   │       │   │   └── usage-tracker.ts     # incrementPost() + 80%/100% quota alerts
│   │       │   │
│   │       │   ├── brand-ingestion/
│   │       │   │   ├── embedder.ts          # Qdrant upsert + incrementalIngestBrandDocument()
│   │       │   │   ├── extractor.ts         # Voice/tone/color extraction from parsed docs
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
│   │           ├── notification.worker.ts   # Fires webhooks + usage alerts
│   │           ├── plan.worker.ts           # Runs strategist → seeds draft posts
│   │           └── post.worker.ts           # Executes scheduled posts via executor
│   │
│   └── dashboard/  (frontend/)             # Next.js 14 App Router
│       └── src/app/(dashboard)/dashboard/
│           ├── page.tsx                     # Overview / home
│           ├── accounts/                    # Social account OAuth management
│           ├── agents/                      # Agent CRUD + log viewer
│           │   └── [id]/page.tsx            # Per-agent log stream
│           ├── analytics/                   # Cross-brand analytics
│           ├── billing/                     # Subscription + usage
│           ├── brands/                      # Brand profiles + ingestion
│           │   └── [id]/
│           │       ├── page.tsx
│           │       └── ingest/page.tsx
│           ├── campaigns/                   # Campaign CRUD + rollup view
│           │   └── [id]/page.tsx
│           ├── plans/                       # Marketing plan list + detail
│           │   └── [id]/page.tsx
│           ├── repurpose/                   # Blog URL → social posts
│           ├── review/                      # HITL review queue (filter + bulk actions)
│           ├── settings/                    # Org settings + guardrails
│           ├── team/                        # Team invite + RBAC management
│           └── webhooks/                    # Webhook endpoint CRUD
│
├── packages/
│   ├── types/
│   │   └── src/
│   │       ├── index.ts         # Re-exports all types
│   │       └── platforms.ts     # Platform union type (14 values)
│   │
│   └── config/
│       └── src/
│           ├── index.ts         # Zod schemas: post, plan, agent, billing
│           └── product.ts       # productConfig — name, limits, model IDs
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
