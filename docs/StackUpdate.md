# Anthyx — Stack Migration & Future-Proof Architecture

> **Purpose:** Full technical specification for migrating from the current Express monorepo to a polyglot service architecture: Laravel API · TypeScript Ingestor · TypeScript Agent Service · FastMCP server · Next.js Frontend  
> **LLM Provider:** Google Gemini (replacing Anthropic Claude)  
> **MCP Library:** `fastmcp` (replacing `@modelcontextprotocol/sdk`)  
> **Deployment goal:** Every service independently deployable and scalable

---

## Table of Contents

1. [Why This Architecture](#1-why-this-architecture)
2. [Target Directory Structure](#2-target-directory-structure)
3. [Inter-Service Communication Contract](#3-inter-service-communication-contract)
4. [Service 1 — Laravel API](#4-service-1--laravel-api)
5. [Service 2 — Ingestor](#5-service-2--ingestor)
6. [Service 3 — Agent Service](#6-service-3--agent-service)
7. [Service 4 — MCP Server (fastmcp)](#7-service-4--mcp-server-fastmcp)
8. [Service 5 — Frontend (Next.js)](#8-service-5--frontend-nextjs)
9. [Gemini Migration](#9-gemini-migration)
10. [FastMCP Migration](#10-fastmcp-migration)
11. [Shared Infrastructure](#11-shared-infrastructure)
12. [Database Ownership Model](#12-database-ownership-model)
13. [Authentication Across Services](#13-authentication-across-services)
14. [Environment Variables](#14-environment-variables)
15. [Phased Migration Plan](#15-phased-migration-plan)
16. [Deployment Topology](#16-deployment-topology)
17. [What to Keep vs Rewrite](#17-what-to-keep-vs-rewrite)

---

## 1. Why This Architecture

### Problems with the current monorepo

| Problem | Impact |
|---------|--------|
| Express handles API + workers + MCP in one process | You can't scale posting workers without also scaling the HTTP API |
| All services share the same Node.js runtime | A memory leak in the agent pipeline takes down the whole API |
| Brand ingestion is synchronous in the request cycle | Long-running PDF/URL parses block resources |
| One `pnpm build` builds everything | A frontend change forces a full API rebuild in CI |
| Auth, billing, CRUD mixed with AI orchestration | Hard to hand off or audit any single layer |

### Why Laravel for the API

- **Battle-tested primitives:** Laravel Sanctum handles auth, Laravel Horizon handles queues, Eloquent handles DB — all production-hardened with mature ecosystem
- **Migrations with rollbacks:** Eloquent migrations are reversible and team-friendly vs. Drizzle's one-way push model
- **Queue integration:** `dispatch(new IngestBrandJob(...))->onQueue('ingestor')` — Laravel puts the job on Redis; the Node.js Ingestor picks it up from the same queue
- **Stripe webhooks:** Laravel's webhook handling with signature verification is 3 lines
- **RBAC:** Spatie `laravel-permission` package gives org-scoped RBAC out of the box
- **No client-side code:** PHP never ships to the browser, so there's no risk of leaking secrets in a bundle

### Why Node.js for Ingestor and Agent

- The libraries you depend on (`pdf-parse`, `@google/generative-ai`, Qdrant JS client, `fastmcp`, BullMQ) have first-class Node.js support
- The brand ingestion pipeline and agent orchestration are fundamentally async I/O workloads — Node.js is optimal
- You can keep all current TypeScript code with minimal changes

### Why separate Ingestor from Agent

- Ingestion is CPU/memory intensive (PDF parsing, chunking, embedding) and runs infrequently
- Agent orchestration is LLM-latency bound and runs on every content generation cycle
- They should scale independently: you might need 10 agent replicas but only 1 ingestor

### Why fastmcp over the official SDK

- `fastmcp` gives you a Zod-first tool API — same pattern you already use for request validation
- SSE transport is built in; no manual session map management (which you had to write manually in `mcp/server.ts`)
- TypeScript-first with full inference from your Zod schemas
- Lighter bundle, faster cold starts

### Why Gemini

- `gemini-2.0-flash` is significantly cheaper per token than Claude Sonnet for copywriting/reviewing tasks
- `gemini-2.0-pro` handles long-context brand ingestion analysis well
- The `@google/generative-ai` SDK is already in your `package.json`
- Gemini's structured output (`responseMimeType: "application/json"`) replaces Anthropic's tool-use JSON extraction

---

## 2. Target Directory Structure

```
Anthyx/
│
│  # ── Monorepo tooling ─────────────────────────────────────────────
├── turbo.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── tsconfig.base.json
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example
│
│  # ── Services ─────────────────────────────────────────────────────
├── services/
│   │
│   ├── api/                    # Laravel 11 — HTTP API, auth, billing, CRUD
│   │   ├── app/
│   │   │   ├── Http/
│   │   │   │   ├── Controllers/
│   │   │   │   │   ├── AuthController.php
│   │   │   │   │   ├── BrandController.php
│   │   │   │   │   ├── AgentController.php
│   │   │   │   │   ├── AccountController.php
│   │   │   │   │   ├── PlanController.php
│   │   │   │   │   ├── PostController.php
│   │   │   │   │   ├── BillingController.php
│   │   │   │   │   ├── AnalyticsController.php
│   │   │   │   │   └── GuardrailController.php
│   │   │   │   └── Middleware/
│   │   │   │       └── PlanLimitMiddleware.php
│   │   │   ├── Jobs/
│   │   │   │   ├── DispatchIngestJob.php     # Pushes to 'ingestor' queue
│   │   │   │   ├── DispatchPlanJob.php       # Pushes to 'agent:plan' queue
│   │   │   │   └── DispatchContentJob.php    # Pushes to 'agent:content' queue
│   │   │   ├── Models/
│   │   │   │   ├── Organization.php
│   │   │   │   ├── User.php
│   │   │   │   ├── BrandProfile.php
│   │   │   │   ├── Agent.php
│   │   │   │   ├── SocialAccount.php
│   │   │   │   ├── MarketingPlan.php
│   │   │   │   ├── ScheduledPost.php
│   │   │   │   ├── PostAnalytic.php
│   │   │   │   ├── PlanTier.php
│   │   │   │   ├── Subscription.php
│   │   │   │   └── UsageRecord.php
│   │   │   └── Services/
│   │   │       ├── BillingService.php        # Stripe, plan limits, overage
│   │   │       ├── OAuthProxyService.php     # Token refresh, AES encryption
│   │   │       └── GuardrailService.php
│   │   ├── database/
│   │   │   ├── migrations/                   # All schema migrations live here
│   │   │   └── seeders/
│   │   │       └── PlanTierSeeder.php
│   │   ├── routes/
│   │   │   └── api.php
│   │   ├── config/
│   │   │   └── product.php                   # PHP equivalent of productConfig
│   │   ├── composer.json
│   │   └── Dockerfile
│   │
│   ├── ingestor/               # Node.js — brand ingestion pipeline (standalone)
│   │   ├── src/
│   │   │   ├── index.ts        # Worker entry — consumes 'ingestor' queue
│   │   │   ├── parser.ts       # pdf-parse, cheerio, fs (unchanged from current)
│   │   │   ├── extractor.ts    # Gemini extraction (replaces Claude)
│   │   │   └── embedder.ts     # OpenAI/Gemini embeddings → Qdrant (unchanged)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── Dockerfile
│   │
│   ├── agent/                  # Node.js — agent orchestration pipeline
│   │   ├── src/
│   │   │   ├── index.ts        # Worker entry — consumes 'agent:plan', 'agent:content', 'post:execute'
│   │   │   ├── orchestrator.ts # Runs Copywriter → Reviewer loop (mostly unchanged)
│   │   │   ├── strategist.ts   # Gemini Pro — plan generation
│   │   │   ├── copywriter.ts   # Gemini Flash — content generation
│   │   │   ├── reviewer.ts     # Gemini Flash-8B — adversarial gate
│   │   │   ├── brand-context.ts
│   │   │   ├── prompt-builder.ts
│   │   │   ├── guardrails.ts
│   │   │   ├── logger.ts
│   │   │   └── workers/
│   │   │       ├── plan.worker.ts
│   │   │       ├── content.worker.ts
│   │   │       ├── post.worker.ts
│   │   │       └── analytics.worker.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── Dockerfile
│   │
│   ├── mcp/                    # Node.js — fastmcp server (sidecar to agent)
│   │   ├── src/
│   │   │   ├── index.ts        # fastmcp server entry
│   │   │   └── tools/          # One file per tool (all ported from current mcp/tools/)
│   │   │       ├── retrieve-brand-context.ts
│   │   │       ├── retrieve-brand-voice.ts
│   │   │       ├── retrieve-brand-rules.ts
│   │   │       ├── retrieve-diet-instructions.ts
│   │   │       ├── read-engagement-analytics.ts
│   │   │       ├── schedule-post.ts
│   │   │       ├── web-search-trends.ts
│   │   │       └── generate-image-asset.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── Dockerfile
│   │
│   └── posting/                # Node.js — social publishing worker (optional split)
│       ├── src/
│       │   ├── index.ts
│       │   ├── social-mcp.ts   # Direct port from current (unchanged)
│       │   ├── executor.ts
│       │   ├── proxy-router.ts
│       │   └── oauth-proxy/    # Direct port from current (unchanged)
│       ├── package.json
│       ├── tsconfig.json
│       └── Dockerfile
│
│  # ── Frontend ─────────────────────────────────────────────────────
├── frontend/                   # Next.js 14 (moved from apps/dashboard)
│   ├── src/
│   │   ├── app/
│   │   ├── components/         # Direct port from current dashboard/components/
│   │   └── lib/
│   ├── package.json
│   ├── next.config.mjs
│   ├── tailwind.config.ts
│   └── Dockerfile
│
│  # ── Shared TypeScript packages ────────────────────────────────────
└── packages/
    ├── types/                  # Shared TS interfaces — used by Node.js services + frontend
    │   └── src/
    │       ├── agents.ts
    │       ├── billing.ts
    │       ├── plans.ts
    │       └── platforms.ts
    └── queue-contracts/        # NEW — queue job payload types shared across services
        └── src/
            ├── index.ts
            ├── ingest.ts       # IngestBrandPayload
            ├── agent.ts        # PlanJobPayload, ContentJobPayload
            └── post.ts         # PostExecutionPayload
```

---

## 3. Inter-Service Communication Contract

All async work flows through Redis queues. Laravel never calls Node.js over HTTP — it dispatches jobs. This keeps services fully decoupled.

```
Browser/Mobile
     │  HTTPS
     ▼
┌─────────────┐
│  Laravel    │  ← auth, CRUD, billing, plan limits, OAuth
│  (api/)     │
└──────┬──────┘
       │ Redis queue dispatch
       │
       ├── queue: ingestor ──────────────────► Ingestor service
       │         payload: { brandId, sourceType, path/url }
       │
       ├── queue: agent:plan ────────────────► Agent service (plan.worker)
       │         payload: { planId, brandId, agentId, platforms, goals }
       │
       ├── queue: agent:content ─────────────► Agent service (content.worker)
       │         payload: { postId, brandId, agentId, planItemId }
       │
       └── queue: post:execute ──────────────► Agent service (post.worker)
                 payload: { postId, socialAccountId }

Agent service ◄────── SSE ──────────────────── MCP server (mcp/)
                   (tool calls for Qdrant, DB, scheduling)

Agent service ──── queue: analytics ─────────► Agent service (analytics.worker)
                   (self-dispatched after publish)
```

### Queue payload types (packages/queue-contracts)

These TypeScript interfaces are shared between services (enforced via Zod at consumer boundaries):

```typescript
// packages/queue-contracts/src/ingest.ts
export interface IngestBrandPayload {
  brandId: string;
  organizationId: string;
  sourceType: "pdf" | "url" | "markdown" | "plaintext";
  filePath?: string;    // temp path for PDF/markdown
  url?: string;
  rawText?: string;     // pre-fetched text (skips parser for plaintext)
  sourceName?: string;  // display name for the source document
}

// packages/queue-contracts/src/agent.ts
export interface PlanJobPayload {
  planId: string;
  brandId: string;
  agentId: string;
  organizationId: string;
  platforms: string[];
  goals: string[];
  startDate: string;
}

export interface ContentJobPayload {
  postId: string;
  planId: string;
  brandId: string;
  agentId: string;
  organizationId: string;
}

// packages/queue-contracts/src/post.ts
export interface PostExecutionPayload {
  postId: string;
  socialAccountId: string;
  organizationId: string;
}
```

### HTTP calls (synchronous, frontend → Laravel only)

The frontend calls `NEXT_PUBLIC_API_URL/v1/...` only. It never calls Node.js services directly. Laravel is the single HTTP gateway.

---

## 4. Service 1 — Laravel API

### Setup

```bash
composer create-project laravel/laravel services/api
cd services/api
composer require laravel/sanctum spatie/laravel-permission stripe/stripe-php
php artisan vendor:publish --provider="Laravel\Sanctum\SanctumServiceProvider"
```

### Auth — Laravel Sanctum + JWT for service auth

Sanctum issues opaque tokens for the browser session. For service-to-service (if ever needed), use a shared secret in the queue job payload — never HTTP between services.

```php
// routes/api.php
Route::prefix('v1')->group(function () {
    Route::post('/auth/register', [AuthController::class, 'register']);
    Route::post('/auth/login',    [AuthController::class, 'login']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::apiResource('brands',     BrandController::class);
        Route::apiResource('agents',     AgentController::class);
        Route::apiResource('accounts',   AccountController::class);
        Route::apiResource('plans',      PlanController::class);
        Route::apiResource('posts',      PostController::class);
        Route::get('analytics',          [AnalyticsController::class, 'index']);
        Route::apiResource('guardrails', GuardrailController::class);
        Route::prefix('billing')->group(function () {
            Route::get('/',            [BillingController::class, 'show']);
            Route::post('/subscribe',  [BillingController::class, 'subscribe']);
            Route::post('/overage-cap',[BillingController::class, 'updateOverageCap']);
        });
    });

    // Stripe webhook — no auth, signed by Stripe
    Route::post('/billing/webhook', [BillingController::class, 'webhook']);
});
```

### Plan limits middleware

```php
// app/Http/Middleware/PlanLimitMiddleware.php
class PlanLimitMiddleware
{
    public function handle(Request $request, Closure $next, string $resource): Response
    {
        $orgId = $request->user()->organization_id;
        $sub   = Subscription::where('organization_id', $orgId)->firstOrFail();
        $tier  = PlanTier::where('tier', $sub->tier)->firstOrFail();

        $count = match($resource) {
            'brand'   => BrandProfile::where('organization_id', $orgId)->count(),
            'agent'   => Agent::where('organization_id', $orgId)->count(),
            'account' => SocialAccount::where('organization_id', $orgId)->where('is_active', true)->count(),
            default   => 0,
        };

        $limit = match($resource) {
            'brand'   => $tier->max_brands,
            'agent'   => $tier->max_agents,
            'account' => $tier->max_social_accounts,
            default   => -1,
        };

        if ($limit !== -1 && $count >= $limit) {
            return response()->json([
                'error'     => 'Plan limit reached',
                'resource'  => $resource,
                'message'   => "Your {$sub->tier} plan allows {$limit} {$resource}(s). Upgrade to add more.",
            ], 402);
        }

        return $next($request);
    }
}

// Register in bootstrap/app.php:
// ->withMiddleware(function (Middleware $middleware) {
//     $middleware->alias(['plan.limit' => PlanLimitMiddleware::class]);
// })

// Usage in routes:
Route::post('/brands', [BrandController::class, 'store'])
    ->middleware('plan.limit:brand');
```

### Dispatching jobs to Node.js services

Laravel and Node.js share the same Redis instance. Laravel pushes a BullMQ-compatible payload:

```php
// app/Jobs/DispatchIngestJob.php
use Illuminate\Support\Facades\Redis;

class DispatchIngestJob
{
    public static function dispatch(array $payload): void
    {
        // BullMQ queue format: key = bull:{queueName}:{jobId}
        $jobId = (string) Str::uuid();
        $job = [
            'id'        => $jobId,
            'name'      => 'ingest-brand',
            'data'      => $payload,
            'opts'      => ['attempts' => 3, 'backoff' => ['type' => 'exponential', 'delay' => 5000]],
            'timestamp' => now()->timestamp * 1000,
        ];

        Redis::rpush("bull:anthyx-ingestor:wait", json_encode($job));
    }
}

// In BrandController::store() after creating the brand:
DispatchIngestJob::dispatch([
    'brandId'        => $brand->id,
    'organizationId' => $request->user()->organization_id,
    'sourceType'     => 'url',
    'url'            => $request->url,
]);
```

> **Note:** Use the `bullmq-helper` approach or the community package `squaretotal/laravel-bullmq` to avoid maintaining the raw Redis payload format by hand.

### Database — Eloquent migrations

All schema is now owned by Laravel migrations. Delete the Drizzle schema and config once migrated. Schema stays the same — just translated:

```php
// database/migrations/2024_01_01_create_organizations_table.php
Schema::create('organizations', function (Blueprint $table) {
    $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
    $table->string('name');
    $table->string('slug')->unique();
    $table->jsonb('global_prohibitions')->default('[]');
    $table->jsonb('sensitive_event_blackouts')->nullable();
    $table->timestamps();
});
```

Run `php artisan migrate` and `php artisan db:seed --class=PlanTierSeeder`.

### OAuth token encryption

Replicate the AES-256-GCM logic from `services/oauth-proxy/crypto.ts` in PHP:

```php
// app/Services/OAuthProxyService.php
public function encryptToken(string $token): string
{
    $key   = base64_decode(config('app.token_encryption_key'));
    $iv    = random_bytes(12);
    $tag   = '';
    $enc   = openssl_encrypt($token, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag, '', 16);
    return base64_encode($iv . $tag . $enc);
}

public function decryptToken(string $encrypted): string
{
    $key  = base64_decode(config('app.token_encryption_key'));
    $raw  = base64_decode($encrypted);
    $iv   = substr($raw, 0, 12);
    $tag  = substr($raw, 12, 16);
    $data = substr($raw, 28);
    return openssl_decrypt($data, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
}
```

Use the same `TOKEN_ENCRYPTION_KEY` env var — both Laravel and the Node.js posting service need it so they can both read encrypted tokens from the DB.

---

## 5. Service 2 — Ingestor

**Location:** `services/ingestor/`  
**Runtime:** Node.js 22 + TypeScript  
**Trigger:** BullMQ consumer on queue `anthyx-ingestor`

This is a direct extraction of `apps/api/src/services/brand-ingestion/` + a BullMQ worker wrapper. The only change is swapping Claude for Gemini in `extractor.ts`.

### Entry point

> **Note:** The worker entry point is `worker.ts` (not `index.ts`). Concurrency defaults to 3 and is configurable via `INGESTOR_CONCURRENCY`.

```typescript
// services/ingestor/src/worker.ts
import { Worker } from "bullmq";
import { Redis } from "ioredis";
import type { IngestBrandPayload } from "@anthyx/queue-contracts";
import { parseSource } from "./parser.js";
import { extractBrandData } from "./extractor.js";
import { ingestBrandDocument } from "./embedder.js";
import { db } from "./db.js";
import { brandProfiles } from "./schema.js";

const connection = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

const worker = new Worker<IngestBrandPayload>(
  "anthyx-ingestor",
  async (job) => {
    const { brandId, organizationId, sourceType, filePath, url, rawText, sourceName } = job.data;

    const parsed = await parseSource({ type: sourceType, path: filePath, url, rawText });
    const extraction = await extractBrandData(parsed.text);

    await ingestBrandDocument(parsed.text, brandId, organizationId, sourceName ?? parsed.sourceName, extraction);

    // Update brand profile fields directly — ingestor owns this write
    await db.update(brandProfiles).set({
      industry: extraction.industry,
      voiceTraits: extraction.voiceTraits,
      toneDescriptors: extraction.toneDescriptors,
      primaryColors: extraction.primaryColors,
      secondaryColors: extraction.secondaryColors,
      typography: extraction.typography,
      updatedAt: new Date(),
    }).where(eq(brandProfiles.id, brandId));
  },
  { connection, concurrency: parseInt(process.env.INGESTOR_CONCURRENCY ?? "3") }
);

worker.on("failed", (job, err) => console.error(`[ingestor] Job ${job?.id} failed:`, err.message));
```

### extractor.ts — Gemini version

```typescript
// services/ingestor/src/extractor.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { BrandExtraction } from "@anthyx/types";

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genai.getGenerativeModel({ model: "gemini-2.0-pro" });

export async function extractBrandData(text: string): Promise<BrandExtraction> {
  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [{
          text: `Extract brand identity from the following document. Return valid JSON only.

Schema:
{
  "industry": string,
  "voiceTraits": { "professional"?: bool, "witty"?: bool, "aggressive"?: bool, "empathetic"?: bool, "authoritative"?: bool, "casual"?: bool },
  "toneDescriptors": string[],
  "primaryColors": string[],   // hex codes only e.g. "#FF5733"
  "secondaryColors": string[],
  "typography": { "primary": string|null, "secondary": string|null },
  "brandStatements": string[], // max 5
  "audienceNotes": string[]    // max 3
}

Document:
${text.slice(0, 30000)}`
        }]
      }
    ],
    generationConfig: { responseMimeType: "application/json" }
  });

  const raw = result.response.text();
  return JSON.parse(raw) as BrandExtraction;
}
```

### package.json

```json
{
  "name": "@anthyx/ingestor",
  "dependencies": {
    "@anthyx/queue-contracts": "workspace:*",
    "@anthyx/types": "workspace:*",
    "@google/generative-ai": "^0.24.1",
    "@qdrant/js-client-rest": "^1.9.0",
    "bullmq": "^5.0.0",
    "cheerio": "^1.0.0",
    "ioredis": "^5.3.0",
    "openai": "^4.47.0",
    "pdf-parse": "^1.1.1",
    "pg": "^8.11.0"
  }
}
```

---

## 6. Service 3 — Agent Service

**Location:** `services/agent/`  
**Runtime:** Node.js 22 + TypeScript  
**Trigger:** BullMQ consumers on `agent:plan`, `agent:content`, `post:execute`, `anthyx-analytics`  
**MCP connection:** HTTP SSE to `services/mcp` on `MCP_SSE_URL`

This is a direct port of the agent layer. The only changes are:
1. Gemini replaces Claude (see Section 9)
2. The MCP client connects to the standalone `services/mcp` server over HTTP instead of in-process

### Connecting to the external MCP server

```typescript
// services/agent/src/mcp-client.ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

let mcpClient: Client | null = null;

export async function getMcpClient(): Promise<Client> {
  if (mcpClient) return mcpClient;

  const transport = new SSEClientTransport(
    new URL(process.env.MCP_SSE_URL!)  // e.g. http://mcp-service:3100/mcp/sse
  );

  mcpClient = new Client({ name: "anthyx-agent", version: "1.0.0" });
  await mcpClient.connect(transport);
  return mcpClient;
}

export async function callMcpTool<T = unknown>(
  toolName: string,
  args: Record<string, unknown>
): Promise<T> {
  const client = await getMcpClient();
  const result = await client.callTool({ name: toolName, arguments: args });
  return result.content[0]?.text
    ? JSON.parse(result.content[0].text as string) as T
    : result.content as T;
}
```

### Workers

Port all current workers directly into `services/agent/src/workers/`. The only import changes are:

```typescript
// Before (current)
import { publishToplatform } from "../services/posting/executor";

// After — call the posting service via queue, or keep posting in agent for simplicity
// Option A: agent directly calls social-mcp.ts (simpler, good for v1)
import { publishPost } from "./social-mcp";

// Option B: agent pushes to 'post:execute' queue and posting service handles it (better at scale)
await postQueue.add("execute", { postId, socialAccountId, organizationId });
```

Start with Option A. Split out the posting service when you need to scale posting independently.

---

## 7. Service 4 — MCP Server (fastmcp)

**Location:** `services/mcp/`  
**Runtime:** Node.js 22 + TypeScript  
**Transport:** SSE on port 3100  
**Package:** `fastmcp`

### Installation

```bash
cd services/mcp
pnpm add fastmcp zod
```

### index.ts — full server

```typescript
// services/mcp/src/index.ts
import { FastMCP } from "fastmcp";
import { z } from "zod";
import { retrieveBrandContext } from "./tools/retrieve-brand-context";
import { retrieveBrandVoice } from "./tools/retrieve-brand-voice";
import { retrieveBrandRules } from "./tools/retrieve-brand-rules";
import { retrieveDietInstructions } from "./tools/retrieve-diet-instructions";
import { readEngagementAnalytics } from "./tools/read-engagement-analytics";
import { schedulePost } from "./tools/schedule-post";
import { webSearchTrends } from "./tools/web-search-trends";
import { generateImageAsset } from "./tools/generate-image-asset";

const mcp = new FastMCP("anthyx-mcp-server");

mcp.addTool({
  name: "retrieve_brand_context",
  description: "Retrieve relevant brand knowledge chunks and voice metadata from Qdrant",
  parameters: z.object({
    brandProfileId: z.string().uuid(),   // NOTE: uses brandProfileId, not brandId
    query: z.string(),
    topK: z.number().int().min(1).max(20).default(10),
  }),
  execute: async (args) => retrieveBrandContext(args),
});

mcp.addTool({
  name: "retrieve_brand_voice",
  description: "Retrieve brand voice rules, tone descriptors, and brand statements for a topic",
  parameters: z.object({
    brandProfileId: z.string().uuid(),
    topic: z.string(),   // topic-based retrieval, not platform-based
  }),
  execute: async (args) => retrieveBrandVoice(args),
});

mcp.addTool({
  name: "retrieve_brand_rules",
  description: "Retrieve all active brand guidelines including voice traits, tone, and colors",
  parameters: z.object({
    brandProfileId: z.string().uuid(),
  }),
  execute: async (args) => retrieveBrandRules(args),
});

mcp.addTool({
  name: "retrieve_diet_instructions",
  description: "Retrieve content diet instructions and prohibitions for an agent",
  parameters: z.object({
    agentId: z.string().uuid(),
  }),
  execute: async (args) => retrieveDietInstructions(args),
});

mcp.addTool({
  name: "read_engagement_analytics",
  description: "Read post engagement analytics for a brand profile and classify content performance",
  parameters: z.object({
    brandProfileId: z.string().uuid(),
    lookbackDays: z.number().int().min(1).max(90).default(30),
  }),
  execute: async (args) => readEngagementAnalytics(args),
});

mcp.addTool({
  name: "schedule_post",
  description: "Schedule an approved post for publishing via BullMQ with jitter",
  parameters: z.object({
    postId: z.string().uuid(),
    scheduledAt: z.string(),   // ISO 8601 datetime string
  }),
  execute: async (args) => schedulePost(args),
});

mcp.addTool({
  name: "web_search_trends",
  description: "Search for trending topics and news in an industry using Tavily",
  parameters: z.object({
    industry: z.string(),
    keywords: z.array(z.string()).min(1).max(10),
    timeframe: z.enum(["7d", "30d"]).default("7d"),
  }),
  execute: async (args) => webSearchTrends(args),
});

mcp.addTool({
  name: "generate_image_asset",
  description: "Generate a marketing image asset via DALL-E 3 aligned with brand colors",
  parameters: z.object({
    prompt: z.string(),
    brandColors: z.array(z.string()),   // hex codes e.g. ["#FF5733"]
    aspectRatio: z.enum(["1:1", "16:9"]).default("1:1"),
  }),
  execute: async (args) => generateImageAsset(args),
});

mcp.start({
  transportType: "sse",
  sse: {
    endpoint: "/mcp/sse",
    port: parseInt(process.env.MCP_PORT ?? "3100"),
  },
});

console.log("[MCP] fastmcp server started on port 3100");
```

### Porting existing tools

Each tool in `apps/api/src/mcp/tools/*.ts` maps directly. Change only the export shape:

```typescript
// Before (current pattern)
export const retrieveBrandContextTool = {
  name: "retrieve_brand_context",
  inputSchema: z.object({ ... }),
  handler: async (args) => { ... }
};

// After (fastmcp pattern — just export the execute function)
export async function retrieveBrandContext(args: {
  brandId: string;
  query: string;
  topK: number;
}): Promise<string> {
  // same implementation as current handler
  // return JSON.stringify(results) — fastmcp expects string return
}
```

### package.json

```json
{
  "name": "@anthyx/mcp",
  "dependencies": {
    "@anthyx/types": "workspace:*",
    "@qdrant/js-client-rest": "^1.9.0",
    "bullmq": "^5.0.0",
    "fastmcp": "^1.0.0",
    "ioredis": "^5.3.0",
    "pg": "^8.11.0",
    "zod": "^3.22.0"
  }
}
```

---

## 8. Service 5 — Frontend (Next.js)

**Location:** `frontend/`  
**Move from:** `apps/dashboard/`

This is a directory rename + one config change. No logic changes required.

### Steps

```bash
# 1. Move the directory
cp -r apps/dashboard frontend

# 2. Update package.json name
# "@anthyx/dashboard" → "@anthyx/frontend"

# 3. Update pnpm-workspace.yaml
# Change "apps/*" → "services/*", "frontend"

# 4. Update next.config.mjs — no changes needed

# 5. Auth: lib/auth.ts stays identical
# NEXT_PUBLIC_API_URL points to Laravel: https://api.anthyx.ai
```

### What changes for the frontend

- `NEXT_PUBLIC_API_URL` points to the Laravel API (same endpoint structure, same `/v1/...` prefix — Laravel uses the same routes)
- `next-auth` credentials provider calls `/v1/auth/login` — no change
- All data fetching via `lib/api.ts` — no change
- Components are identical — no changes

---

## 9. Gemini Migration

### Model mapping

| Current (Claude) | Deployed (Gemini) | Role | Env override |
|---|---|---|---|
| `claude-opus-4-7` | `gemini-1.5-pro` | Strategist (complex, long-context) | `GEMINI_STRATEGIST_MODEL` |
| `claude-sonnet-4-6` | `gemini-1.5-flash` | Copywriter (fast, quality) | `GEMINI_COPYWRITER_MODEL` |
| `claude-haiku-4-5` | `gemini-1.5-flash-8b` | Reviewer (cheapest, fast gate) | `GEMINI_REVIEWER_MODEL` |
| — | `gemini-1.5-flash` | Brand extraction (ingestor) | `GEMINI_EXTRACTION_MODEL` |

> **Note:** All model names are configurable via environment variable. The defaults above (`gemini-1.5-*`) are what's running in production today. The plan called for `gemini-2.0-*` — upgrade by setting the env vars once those models stabilize.

### SDK setup

```typescript
// services/agent/src/gemini.ts  — shared client module
import { GoogleGenerativeAI, type GenerationConfig } from "@google/generative-ai";

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export function getModel(model: "pro" | "flash" | "flash-8b") {
  const modelMap = {
    pro:        process.env.GEMINI_STRATEGIST_MODEL ?? "gemini-1.5-pro",
    flash:      process.env.GEMINI_COPYWRITER_MODEL ?? "gemini-1.5-flash",
    "flash-8b": process.env.GEMINI_REVIEWER_MODEL   ?? "gemini-1.5-flash-8b",
  };
  return genai.getGenerativeModel({ model: modelMap[model] });
}

export async function generateStructuredOutput<T>(
  model: "pro" | "flash" | "flash-8b",
  prompt: string,
  systemPrompt?: string,
): Promise<T> {
  const m = getModel(model);
  const result = await m.generateContent({
    systemInstruction: systemPrompt,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.7,
    } satisfies GenerationConfig,
  });
  return JSON.parse(result.response.text()) as T;
}
```

### Strategist migration

```typescript
// services/agent/src/strategist.ts

// Before (Anthropic)
import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic();
const msg = await client.messages.create({
  model: "claude-opus-4-7",
  max_tokens: 8096,
  system: systemPrompt,
  messages: [{ role: "user", content: userPrompt }],
  tools: [...],
});

// After (Gemini)
import { generateStructuredOutput } from "./gemini";
import type { PlanItem } from "@anthyx/types";

const plan = await generateStructuredOutput<PlanItem[]>(
  "pro",
  userPrompt,
  systemPrompt,
);
```

### Copywriter migration

```typescript
// services/agent/src/copywriter.ts

// Before
const msg = await anthropic.messages.create({
  model: "claude-sonnet-4-6",
  ...
});

// After
import { generateStructuredOutput } from "./gemini";
import type { CopywriterOutput } from "@anthyx/types";

const output = await generateStructuredOutput<CopywriterOutput>(
  "flash",
  prompt,
  systemPrompt,
);
```

### Reviewer migration

```typescript
// services/agent/src/reviewer.ts

// After
import { generateStructuredOutput } from "./gemini";
import type { ReviewerOutput } from "@anthyx/types";

const verdict = await generateStructuredOutput<ReviewerOutput>(
  "flash-8b",
  reviewPrompt,
  reviewerSystemPrompt,
);
```

### Key behavioral differences to account for

| Concern | Notes |
|---------|-------|
| Tool use | Gemini supports function calling, but you don't need it — the agent calls MCP tools externally via the MCP client, not through the LLM's native tool-calling. Pass MCP results as context in the next prompt instead. |
| JSON output | Use `responseMimeType: "application/json"` in `generationConfig` — Gemini guarantees valid JSON, no need for regex extraction |
| System prompt | Pass as `systemInstruction` field, not in `contents` array |
| Context window | Gemini 2.0 Pro supports 2M tokens — no chunking needed for brand docs |
| Rate limits | Gemini has per-minute token limits; add exponential backoff in `generateStructuredOutput` |

---

## 10. FastMCP Migration

### Why fastmcp over the official SDK

The official `@modelcontextprotocol/sdk` requires you to:
1. Instantiate `McpServer`
2. Pass `inputSchema.shape as Record<string, unknown>` (type-unsafe cast)
3. Manage a `Map<sessionId, SSEServerTransport>` manually
4. Wire up `/mcp/sse` and `/mcp/messages` routes yourself

`fastmcp` gives you:

```typescript
// Official SDK — 70 lines of plumbing
// fastmcp — this is the entire server:
const mcp = new FastMCP("server-name");
mcp.addTool({ name: "...", parameters: z.object({...}), execute: async (args) => "..." });
mcp.start({ transportType: "sse", sse: { endpoint: "/mcp/sse", port: 3100 } });
```

### Tool return type

fastmcp tools return a `string`. For structured data, `JSON.stringify` your result:

```typescript
execute: async ({ brandId, query, topK }) => {
  const results = await qdrant.search(...);
  return JSON.stringify(results);  // Agent parses this back
}
```

### Agent consuming fastmcp tools

The agent uses the official MCP **client** SDK to call the fastmcp **server**:

```typescript
// services/agent/src/mcp-client.ts (shown in Section 6)
// The client side still uses @modelcontextprotocol/sdk/client — that's fine.
// fastmcp only replaces the SERVER library.
```

---

## 11. Shared Infrastructure

All services share these infrastructure components. Run them via Docker Compose locally; managed services in production.

| Component | Docker image | Purpose |
|-----------|-------------|---------|
| PostgreSQL 16 | `postgres:16-alpine` | Primary DB — owned by Laravel migrations |
| Redis 7 | `redis:7-alpine` | BullMQ queues + OAuth state cache |
| Qdrant | `qdrant/qdrant` | Vector store for brand embeddings |

### docker-compose.yml (infra only)

```yaml
version: "3.9"
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: anthyx
      POSTGRES_USER: anthyx
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes: [pgdata:/var/lib/postgresql/data]
    ports: ["5432:5432"]

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    ports: ["6379:6379"]

  qdrant:
    image: qdrant/qdrant
    ports: ["6333:6333", "6334:6334"]
    volumes: [qdrantdata:/qdrant/storage]

volumes:
  pgdata:
  qdrantdata:
```

### docker-compose.services.yml (application services)

```yaml
version: "3.9"
services:
  api:
    build: ./services/api
    ports: ["8000:8000"]
    environment:
      DB_HOST: postgres
      REDIS_HOST: redis
    depends_on: [postgres, redis]

  ingestor:
    build: ./services/ingestor
    environment:
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      DATABASE_URL: postgres://anthyx:${POSTGRES_PASSWORD}@postgres:5432/anthyx
      QDRANT_URL: http://qdrant:6333
      GEMINI_API_KEY: ${GEMINI_API_KEY}
    depends_on: [postgres, redis, qdrant]

  agent:
    build: ./services/agent
    environment:
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      DATABASE_URL: postgres://anthyx:${POSTGRES_PASSWORD}@postgres:5432/anthyx
      QDRANT_URL: http://qdrant:6333
      GEMINI_API_KEY: ${GEMINI_API_KEY}
      MCP_SSE_URL: http://mcp:3100/mcp/sse
    depends_on: [postgres, redis, qdrant, mcp]

  mcp:
    build: ./services/mcp
    ports: ["3100:3100"]
    environment:
      DATABASE_URL: postgres://anthyx:${POSTGRES_PASSWORD}@postgres:5432/anthyx
      QDRANT_URL: http://qdrant:6333
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
    depends_on: [postgres, redis, qdrant]

  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    environment:
      NEXT_PUBLIC_API_URL: http://api:8000
    depends_on: [api]
```

---

## 12. Database Ownership Model

Single Postgres instance, single database. Laravel owns all migrations.

| Principle | Rule |
|-----------|------|
| **One writer per table** | Only Laravel writes to `organizations`, `users`, `subscriptions`, `scheduled_posts` status changes |
| **Ingestor writes** | Ingestor writes to `brand_profiles` (extraction results) and upserts Qdrant |
| **Agent writes** | Agent writes to `marketing_plans`, `scheduled_posts` (new rows + content), `agent_logs`, `post_analytics` |
| **No cross-service FK enforcement at app layer** | Both services read the same Postgres — they rely on FK constraints in the DB, not application-level joins |
| **Schema changes always via Laravel migrations** | Never alter tables from a Node.js service directly |

### How Node.js services connect to Postgres

Keep `drizzle-orm` in Node.js services for reads and targeted writes. The schema definition (`db/schema.ts`) stays but is read-only from a migration perspective:

```typescript
// services/agent/src/db/client.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema"; // schema.ts is a READ-ONLY reference — no drizzle-kit pushes

const client = postgres(process.env.DATABASE_URL!);
export const db = drizzle(client, { schema });
```

---

## 13. Authentication Across Services

### Browser sessions → Laravel Sanctum

The frontend sends `withCredentials: true`. Laravel Sanctum handles cookie-based sessions. No JWT needed for the browser.

### Service-to-service

Services communicate via Redis queues, not HTTP. Queue payloads include the `organizationId` and `userId` so Node.js services never need to verify auth — they trust the payload came from Laravel (which already validated auth).

If you ever add HTTP endpoints to Node.js services (e.g., a status endpoint), protect them with a shared secret:

```typescript
// Internal service auth — simple shared secret header
app.use("/internal", (req, res, next) => {
  if (req.headers["x-internal-secret"] !== process.env.INTERNAL_SERVICE_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});
```

### Token encryption key

Both Laravel and Node.js posting service read encrypted OAuth tokens from the DB. They must share `TOKEN_ENCRYPTION_KEY`. The AES-256-GCM implementation must be byte-compatible:

```
Node.js: services/posting/src/oauth-proxy/crypto.ts  (unchanged from current)
PHP:     services/api/app/Services/OAuthProxyService.php  (new, see Section 4)
Key:     TOKEN_ENCRYPTION_KEY=<same 32-byte base64 value in both>
```

---

## 14. Environment Variables

### services/api/.env (Laravel)

```bash
APP_KEY=base64:...
DB_CONNECTION=pgsql
DB_HOST=postgres
DB_DATABASE=anthyx
DB_USERNAME=anthyx
DB_PASSWORD=

REDIS_HOST=redis
REDIS_PASSWORD=
REDIS_PORT=6379

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_STARTER_MONTHLY=price_...
STRIPE_PRICE_STARTER_ANNUAL=price_...
STRIPE_PRICE_GROWTH_MONTHLY=price_...
STRIPE_PRICE_GROWTH_ANNUAL=price_...
STRIPE_PRICE_AGENCY_MONTHLY=price_...
STRIPE_PRICE_AGENCY_ANNUAL=price_...
STRIPE_PRICE_SCALE_MONTHLY=price_...
STRIPE_PRICE_SCALE_ANNUAL=price_...

TOKEN_ENCRYPTION_KEY=              # 32-byte base64 — SAME in all services
JWT_SECRET=                        # If you add JWT for mobile clients later

DASHBOARD_URL=https://app.anthyx.ai
```

### services/ingestor/.env + services/agent/.env

```bash
DATABASE_URL=postgres://anthyx:password@postgres:5432/anthyx
REDIS_URL=redis://:password@redis:6379
QDRANT_URL=http://qdrant:6333

GEMINI_API_KEY=
OPENAI_API_KEY=                    # For embeddings (text-embedding-3-small) if not using Gemini embeddings

TOKEN_ENCRYPTION_KEY=              # SAME as Laravel
```

### services/mcp/.env

```bash
DATABASE_URL=postgres://anthyx:password@postgres:5432/anthyx
REDIS_URL=redis://:password@redis:6379
QDRANT_URL=http://qdrant:6333
MCP_PORT=3100

BANNERBEAR_API_KEY=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
BRAVE_SEARCH_API_KEY=              # For web-search-trends tool
```

### frontend/.env.local

```bash
NEXT_PUBLIC_API_URL=https://api.anthyx.ai
AUTH_SECRET=                       # next-auth secret
```

---

## 15. Phased Migration Plan

Each phase is independently deployable. Do not start a phase until the previous is in production.

### Phase status (April 2026)

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Extract frontend | ✅ Complete — `frontend/` in place |
| 2 | Extract MCP server | ✅ Complete — `services/mcp/` running |
| 3 | Extract Ingestor | ✅ Complete — `services/ingestor/` running |
| 4 | Extract Agent Service | ⚠️ Partial — plan + content workers exist; post/analytics workers still in `apps/api`; disabled in compose |
| 5 | Laravel API | ❌ Not started |
| 6 | Remove `apps/api` | ❌ Blocked on Phase 5 |

---

### Phase 1 — Extract the frontend ✅ COMPLETE

**Goal:** Dashboard runs independently, pointed at the existing Express API.

`frontend/` exists, built, and running. `apps/dashboard/` deleted.

---

### Phase 2 — Extract the MCP server ✅ COMPLETE

**Goal:** MCP server runs as a standalone process.

`services/mcp/` is deployed. `apps/api/src/mcp/server.ts` still registers in-process MCP routes for backwards compatibility.

---

### Phase 3 — Extract the Ingestor ✅ COMPLETE

**Goal:** Brand ingestion runs independently, triggered by a queue job.

`services/ingestor/` is deployed. Entry point is `worker.ts`, concurrency is controlled by `INGESTOR_CONCURRENCY` (default 3).

---

### Phase 4 — Extract the Agent Service ⚠️ PARTIAL

**Goal:** Agent orchestration and workers run independently.

**Done:** `services/agent/` exists with `plan.worker.ts` and `content.worker.ts`.  
**Remaining:**
1. Port `post.worker.ts` and `analytics.worker.ts` from `apps/api/src/workers/` → `services/agent/src/workers/`
2. Enable the `agent` service in `docker-compose.yml`
3. Remove agent/plan/content workers from `apps/api/src/workers/index.ts`
4. Monitor `agent_logs` table for 1 billing cycle before removing `apps/api` workers

**Blocker:** `services/agent` is disabled in `docker-compose.yml` — it competes on the same BullMQ queues as the `apps/api` worker process. Re-enable once `apps/api` workers are removed.

---

### Phase 5 — Laravel API (5–10 days)

**Goal:** Replace Express with Laravel. Frontend now calls Laravel.

1. `composer create-project laravel/laravel services/api`
2. Port all routes (see Section 4). Keep URL structure identical (`/v1/...`)
3. Write Eloquent migrations from the existing Drizzle schema
4. Port auth (`AuthController`), billing (`BillingController`), all CRUD controllers
5. Implement `OAuthProxyService` with AES-256-GCM compatible with Node.js crypto
6. Run `php artisan db:seed --class=PlanTierSeeder`
7. Blue-green deploy: run Laravel and Express in parallel on different ports behind a load balancer
8. Switch frontend `NEXT_PUBLIC_API_URL` to Laravel
9. Monitor for 48 hours, then shut down Express

**Risk:** High. Focus on: (a) auth cookie compatibility, (b) AES token encryption byte-compatibility, (c) Stripe webhook signature verification.

---

### Phase 6 — Remove apps/api (1 day)

1. Confirm all services are healthy for 1 full billing cycle
2. Verify Stripe overage invoicing ran correctly (check Stripe dashboard)
3. `rm -rf apps/api`
4. Update `pnpm-workspace.yaml` to remove `apps/*`
5. Archive the Drizzle schema — it's now the reference for Laravel migrations only

---

## 16. Deployment Topology

### Production (per service)

| Service | Platform | Scaling |
|---------|----------|---------|
| `services/api` (Laravel) | Railway / Render / EC2 | Horizontal — stateless, multiple replicas |
| `services/ingestor` | Railway / Fly.io | 1–2 replicas (CPU bound, low frequency) |
| `services/agent` | Railway / Fly.io | 3–10 replicas (LLM latency bound) |
| `services/mcp` | Railway / Fly.io | 2 replicas (stateless SSE) |
| `frontend` | Vercel / Cloudflare Pages | CDN — scales automatically |
| PostgreSQL | Railway Postgres / Supabase | Single primary (Supabase for managed) |
| Redis | Upstash / Railway Redis | Managed |
| Qdrant | Qdrant Cloud | Managed |

### DNS

```
api.anthyx.ai     → Laravel (services/api)
app.anthyx.ai     → Frontend (Vercel)
mcp.anthyx.ai     → MCP server (internal only — no public exposure needed)
```

The MCP server does not need a public DNS entry. Only the agent service calls it, and they communicate over the internal Docker/VPC network.

### Health checks

Each service exposes `GET /health`:

```typescript
// Node.js services
app.get("/health", (_, res) => res.json({ ok: true, ts: new Date() }));
```

```php
// Laravel
Route::get('/health', fn() => response()->json(['ok' => true, 'ts' => now()]));
```

---

## 17. What to Keep vs Rewrite

### Keep (direct port, no logic changes)

| File | Destination |
|------|------------|
| `services/brand-ingestion/parser.ts` | `services/ingestor/src/parser.ts` |
| `services/brand-ingestion/embedder.ts` | `services/ingestor/src/embedder.ts` |
| `services/agent/brand-context.ts` | `services/agent/src/brand-context.ts` |
| `services/agent/prompt-builder.ts` | `services/agent/src/prompt-builder.ts` |
| `services/agent/guardrails.ts` | `services/agent/src/guardrails.ts` |
| `services/agent/logger.ts` | `services/agent/src/logger.ts` |
| `services/agent/orchestrator.ts` | `services/agent/src/orchestrator.ts` |
| `services/posting/social-mcp.ts` | `services/posting/src/social-mcp.ts` (or agent/src/) |
| `services/posting/proxy-router.ts` | Same |
| `services/oauth-proxy/crypto.ts` | `services/posting/src/oauth-proxy/crypto.ts` |
| `services/oauth-proxy/refreshers.ts` | Same |
| `services/assets/` (all 4 files) | `services/agent/src/assets/` |
| `workers/analytics.worker.ts` | `services/agent/src/workers/analytics.worker.ts` |
| `packages/types/` (all) | No change — keep as shared package |
| `apps/dashboard/components/` (all) | `frontend/src/components/` |
| `apps/dashboard/lib/api.ts` | `frontend/src/lib/api.ts` |
| `apps/dashboard/lib/auth.ts` | `frontend/src/lib/auth.ts` |

### Rewrite (LLM swap — COMPLETE)

| File | Status |
|------|--------|
| `services/agent/src/strategist.ts` | ✅ Gemini 1.5 Pro (two-phase: tool-call + formatter) |
| `services/agent/src/copywriter.ts` | ✅ Gemini 1.5 Flash |
| `services/agent/src/reviewer.ts` | ✅ Gemini 1.5 Flash-8B |
| `services/ingestor/src/extractor.ts` | ✅ Gemini 1.5 Flash |
| `apps/api/src/services/agent/llm-client.ts` | ✅ Gemini primary + Claude fallback |

### Rewrite (MCP library swap — COMPLETE for standalone service)

| File | Status |
|------|--------|
| `services/mcp/src/index.ts` | ✅ fastmcp SSE server |
| `services/mcp/src/tools/*.ts` | ✅ Bare async functions (fastmcp pattern) |
| `apps/api/src/mcp/server.ts` | Unchanged — still uses `@modelcontextprotocol/sdk` in-process |

### Rewrite (Laravel — new code, same business logic)

| Current (Express) | New (Laravel) |
|---|---|
| `routes/auth.ts` | `AuthController.php` |
| `routes/brands.ts` | `BrandController.php` |
| `routes/agents.ts` | `AgentController.php` |
| `routes/accounts.ts` | `AccountController.php` |
| `routes/plans.ts` | `PlanController.php` |
| `routes/posts.ts` | `PostController.php` |
| `routes/billing.ts` | `BillingController.php` |
| `routes/guardrails.ts` | `GuardrailController.php` |
| `routes/analytics.ts` | `AnalyticsController.php` |
| `services/billing/stripe.ts` | `BillingService.php` |
| `services/billing/limits.ts` | `PlanLimitMiddleware.php` |
| `services/billing/usage-tracker.ts` | `BillingService::incrementPost()` |
| `services/billing/overage.ts` | `BillingService::calculateOverage()` |
| `db/schema.ts` | `database/migrations/*.php` |
| `db/seed.ts` | `database/seeders/PlanTierSeeder.php` |
| `middleware/auth.ts` | Laravel Sanctum (built-in) |
| `middleware/plan-limits.ts` | `PlanLimitMiddleware.php` |
| `workers/overage.worker.ts` | Laravel scheduled command (`php artisan schedule:run`) |

### Delete entirely (pending Phase 5 — Laravel)

These deletions are blocked on Phase 5. Do not delete until Laravel is in production:

- `apps/api/src/index.ts` — replaced by Laravel
- `apps/api/src/queue/` — queue config moves to each Node.js service individually
- `apps/api/drizzle.config.ts` — replaced by Laravel migrations
- Root `config.ts` and `packages/config/src/product.ts` — replaced by `services/api/config/product.php`
- `packages/config/src/schemas.ts` — request validation moves to Laravel Form Requests in PHP

---

*StackUpdate.md — Anthyx architecture migration guide — updated April 2026*
