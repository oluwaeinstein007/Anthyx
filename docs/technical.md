# Anthyx — Technical Reference Document

> **Version:** 1.0  
> **Status:** Active Development  
> **Audience:** AI Agents, Backend Engineers, DevOps, Frontend Engineers  
> **Stack:** Node.js / TypeScript · MCP · Qdrant · PostgreSQL · Redis/BullMQ · Next.js

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Tech Stack & Tooling](#3-tech-stack--tooling)
4. [Directory Structure](#4-directory-structure)
5. [Database Schema](#5-database-schema)
6. [Brand Ingestion Pipeline](#6-brand-ingestion-pipeline)
7. [Multi-Agent Orchestration (MCP)](#7-multi-agent-orchestration-mcp)
8. [Marketing Plan Engine](#8-marketing-plan-engine)
9. [Task Queue & Scheduler (BullMQ)](#9-task-queue--scheduler-bullmq)
10. [Social Platform Integrations](#10-social-platform-integrations)
11. [Asset Generation Pipeline](#11-asset-generation-pipeline)
12. [Authentication & Security](#12-authentication--security)
13. [API Reference](#13-api-reference)
14. [Frontend Dashboard](#14-frontend-dashboard)
15. [Environment Variables](#15-environment-variables)
16. [Infrastructure & Deployment](#16-infrastructure--deployment)
17. [Development Workflow](#17-development-workflow)
18. [Build Phases & Milestones](#18-build-phases--milestones)
19. [Agent Build Instructions](#19-agent-build-instructions)
20. [Pricing & Monetisation](#20-pricing--monetisation)

---

## 1. System Overview

Anthyx is a **multi-agent autonomous marketing platform**. It ingests a brand's identity (voice, tone, colors, values) and uses AI agents to autonomously generate, schedule, and publish marketing content across social media platforms at scale (5,000+ concurrent scheduled posts).

### Core Capabilities

| Capability            | Description                                                                 | First Available                   |
| --------------------- | --------------------------------------------------------------------------- | --------------------------------- |
| Brand Ingestion       | Parse PDFs, Markdown, URLs → extract voice, tone, hex codes, positioning    | Sandbox                           |
| Agent Personas        | Named agents with per-account behavioral instructions ("Diet Instructions") | Sandbox                           |
| Plan Generation       | 30-day AI-generated marketing calendars per brand + platform                | Sandbox                           |
| Autonomous Posting    | Direct API execution via BullMQ workers — no human trigger needed           | Starter                           |
| Asset Generation      | Brand-color-aware image cards (BannerBear/Cloudinary) + DALL-E AI assets    | Starter (templates) / Growth (AI) |
| HITL Dashboard        | Human review, edit, veto before any post publishes                          | Sandbox                           |
| Autonomous Scheduling | Fire-and-forget scheduled posts without HITL approval                       | Starter                           |
| Feedback Loop         | Engagement scoring → Strategist auto-adjusts future plans                   | Growth                            |
| Agent Silence         | Emergency kill-switch per agent, cancels all queued jobs                    | Starter                           |
| IP Rotation           | Shadow ban protection via dedicated proxy pool per org                      | Scale                             |
| Guardrails            | Org-level negative prompts + sensitive event blackout windows               | Starter                           |
| White-label           | Custom dashboard branding for agency clients                                | Agency                            |

---

## 2. High-Level Architecture

The architecture is deliberately split into three layers: **The Brain** (strategy and reasoning), **The Hands** (execution and posting), and **The Memory** (brand knowledge and state). These layers are loosely coupled — the Brain never directly calls a social API, and the Hands never directly query an LLM.

```
╔══════════════════════════════════════════════════════════════════════╗
║                         Anthyx Platform                           ║
║                                                                      ║
║  ┌──────────────────────────────────────────────────────────────┐   ║
║  │                    LAYER 1: MEMORY                           │   ║
║  │                                                              │   ║
║  │   ┌─────────────────────┐    ┌────────────────────────┐     │   ║
║  │   │  Qdrant             │    │  PostgreSQL             │     │   ║
║  │   │  Brand Memory       │    │  Accounts / Plans /     │     │   ║
║  │   │  (Vectors + RAG)    │    │  Posts / Analytics      │     │   ║
║  │   └─────────────────────┘    └────────────────────────┘     │   ║
║  └──────────────────────────────────────────────────────────────┘   ║
║                              ▲  ▼                                    ║
║  ┌──────────────────────────────────────────────────────────────┐   ║
║  │                    LAYER 2: BRAIN (MCP)                      │   ║
║  │                                                              │   ║
║  │   ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐   │   ║
║  │   │  Strategist  │  │  Copywriter  │  │    Reviewer     │   │   ║
║  │   │  Agent       │  │  Agent       │  │    Agent        │   │   ║
║  │   │              │  │              │  │                 │   │   ║
║  │   │ Generates    │  │ Writes posts │  │ Compliance +    │   │   ║
║  │   │ 30-day plan  │  │ per plan item│  │ Brand-voice QA  │   │   ║
║  │   └──────┬───────┘  └──────┬───────┘  └────────┬────────┘   │   ║
║  │          │                 │                    │            │   ║
║  │          └─────────────────┴────────────────────┘            │   ║
║  │                            │ MCP Tool Calls                  │   ║
║  │   ┌────────────┐  ┌────────▼──────┐  ┌────────────────────┐ │   ║
║  │   │ Web Search │  │ Brand Context │  │  Image Generator   │ │   ║
║  │   │ (Trends)   │  │ (Qdrant RAG)  │  │  (DALL-E 3)        │ │   ║
║  │   └────────────┘  └───────────────┘  └────────────────────┘ │   ║
║  └──────────────────────────────────────────────────────────────┘   ║
║                              ▲  ▼                                    ║
║  ┌──────────────────────────────────────────────────────────────┐   ║
║  │                    LAYER 3: HANDS                            │   ║
║  │                                                              │   ║
║  │   ┌────────────────────────┐    ┌────────────────────────┐  │   ║
║  │   │  Redis / BullMQ        │    │  OAuth Proxy Service   │  │   ║
║  │   │  Post Execution Queue  │    │  Token store, refresh  │  │   ║
║  │   │  Asset Gen Queue       │    │  logic per platform    │  │   ║
║  │   │  Analytics Queue       │    └───────────┬────────────┘  │   ║
║  │   └────────────┬───────────┘                │               │   ║
║  │                │         ┌──────────────────┘               │   ║
║  │                ▼         ▼                                   │   ║
║  │   ┌───────────────────────────────────────────────────────┐ │   ║
║  │   │               Platform Workers                        │ │   ║
║  │   │   X/Twitter · Instagram · LinkedIn · Telegram · Meta  │ │   ║
║  │   │          (via social-mcp or direct SDK)                │ │   ║
║  │   └───────────────────────────────────────────────────────┘ │   ║
║  └──────────────────────────────────────────────────────────────┘   ║
║                              │                                       ║
║               ┌──────────────┘ Engagement Data                      ║
║               ▼                                                      ║
║   ┌───────────────────────┐                                         ║
║   │  Analytics Feed       │ ──────────────────► Strategist Agent    ║
║   │  (Feedback Loop)      │       (adjusts next plan cycle)         ║
║   └───────────────────────┘                                         ║
╚══════════════════════════════════════════════════════════════════════╝
```

### The Three Layers Explained

| Layer           | Responsibility                                                  | Key Rule                                                                 |
| --------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **Memory**      | Stores all brand knowledge (vectors) and operational state (DB) | Single source of truth. Never written to directly by the Execution layer |
| **Brain (MCP)** | All LLM reasoning — strategy, copywriting, compliance review    | Never calls a social media API directly                                  |
| **Hands**       | All I/O with the external world — queuing, OAuth, posting       | Never calls an LLM directly                                              |

### The Three Specialized Agents

Unlike a single "general marketing AI", Anthyx uses **three distinct sub-agents**, each with a narrow responsibility:

| Agent          | Role                                                                                                                                                                                                           | Model                                     |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| **Strategist** | Generates 30-day marketing plans, topic calendars, content pillars. Consumes engagement data from analytics feed to adjust future plans.                                                                       | `gemini-1.5-pro` (env: `GEMINI_STRATEGIST_MODEL`) |
| **Copywriter** | Takes a single plan item and writes the final post text + hashtags for a specific platform + persona. Retrieves brand voice from Qdrant RAG.                                                                   | `gemini-1.5-flash` (env: `GEMINI_COPYWRITER_MODEL`) |
| **Reviewer**   | Separate LLM call that acts as a compliance gate. Checks the Copywriter's output against diet instructions, brand rules, and platform guidelines. Returns `pass`, `fail`, or `rewrite` with specific feedback. | `gemini-1.5-flash-8b` (env: `GEMINI_REVIEWER_MODEL`) |

> **Why three agents?** A single prompt doing all three jobs conflates strategy with execution and lets errors slip through. The Reviewer being a separate call means it has no attachment to the Copywriter's output — it's adversarial by design.

### End-to-End Request Flow

```
PHASE 1 — BRAND SETUP
─────────────────────
User uploads Brand Book (PDF/MD/URL)
        │
        ▼
Brand Ingestion Service
  → Parse raw content
  → LLM extraction: voice traits, colors, tone, positioning
  → Chunk + embed → Qdrant (collection: brand_{brandProfileId})
  → Structured metadata → PostgreSQL (brandProfiles table)


PHASE 2 — AGENT + ACCOUNT SETUP
─────────────────────────────────
User creates Agent persona
  → Name, description, diet instructions
  → Linked to brand profile
  → Mapped to 1..N social accounts (per-platform isolation enforced)
  → Stored in PostgreSQL


PHASE 3 — PLAN GENERATION (Strategist Agent)
─────────────────────────────────────────────
User triggers plan generation
        │
        ▼
Strategist Agent (via MCP)
  → MCP tool: retrieve_brand_context (Qdrant RAG, brand_id filtered)
  → MCP tool: web_search (fetch industry trends, competitor activity)
  → [If feedback loop active] reads engagement data from analytics table
  → Generates 30-day structured calendar (topic, platform, content type, hook, CTA)
  → Stores MarketingPlan + ScheduledPost rows (status: 'draft')


PHASE 4 — CONTENT GENERATION (Copywriter + Reviewer Agents)
─────────────────────────────────────────────────────────────
For each draft post in the plan:
        │
        ▼
Copywriter Agent (via MCP)
  → MCP tool: retrieve_brand_context (voice + tone for this post's topic)
  → Builds prompt: BrandRules + PersonaInstructions + PlatformRules + Topic
  → Generates: { content, hashtags, suggestedMediaPrompt }
        │
        ▼
Reviewer Agent (separate LLM call — adversarial gate)
  → Receives: { generatedContent, brandRules, dietInstructions, platformRules }
  → Returns: { verdict: 'pass'|'fail'|'rewrite', issues: string[], revisedContent?: string }
  → On 'fail': discards post, logs reason, optionally retries (max 2x)
  → On 'rewrite': uses revisedContent, marks as agent-revised
  → On 'pass': post status → 'pending_review'


PHASE 5 — HITL (Human-in-the-Loop)
─────────────────────────────────────
Post enters HITL dashboard (status: 'pending_review')
  → User can: approve / edit + approve / veto / reschedule
  → Approved posts → status: 'approved'
  → Vetoed posts → status: 'vetoed', reason logged


PHASE 6 — EXECUTION (The Hands)
─────────────────────────────────
BullMQ Scheduler picks up approved posts at scheduled time
        │
        ▼
Post Execution Worker
  → Asset generation (if suggestedMediaPrompt exists) → DALL-E 3 → CDN
  → OAuth Proxy Service: fetches decrypted, refreshed token for this account
  → Platform API call (social-mcp or direct SDK)
  → Status → 'published', platform post ID saved
        │
        ▼
Analytics Worker (triggered 30min post-publish)
  → Fetches engagement data from platform API
  → Stores in postAnalytics table
  → If engagement below threshold → signals Strategist feedback loop
```

---

## 3. Tech Stack & Tooling

### Backend

| Tool                                | Version | Purpose                                                               |
| ----------------------------------- | ------- | --------------------------------------------------------------------- |
| Node.js                             | 22 LTS  | Runtime                                                               |
| TypeScript                          | 5.x     | Type safety across entire codebase                                    |
| Express.js                          | 4.x     | HTTP API server                                                       |
| `@google/generative-ai`             | latest  | Primary LLM SDK — Gemini Pro, Flash, Flash-8B                         |
| `fastmcp`                           | latest  | MCP SSE server (`services/mcp`) — Zod-first tool API                  |
| `@modelcontextprotocol/sdk`         | latest  | MCP in-process server (`api/src/mcp/server.ts`)                  |
| Anthropic SDK (`@anthropic-ai/sdk`) | latest  | Claude fallback via `llm-client.ts` `generateWithFallback()`          |
| OpenAI SDK (`openai`)               | 4.x     | Embeddings (text-embedding-3-small) + DALL-E 3 image generation       |
| BullMQ                              | 5.x     | Redis-backed job queue for scheduled posts                            |
| `ioredis`                           | 5.x     | Redis client                                                          |
| `pg` / `drizzle-orm`                | latest  | PostgreSQL ORM                                                        |
| `pdf-parse`                         | 1.x     | PDF text extraction                                                   |
| `cheerio`                           | 1.x     | URL/web scraping for brand ingestion                                  |
| `zod`                               | 3.x     | Runtime schema validation                                             |
| `multer`                            | 1.x     | File upload middleware                                                |
| `node-cron`                         | 3.x     | Internal scheduling fallback                                          |

### Vector Database

| Tool                     | Purpose                             |
| ------------------------ | ----------------------------------- |
| Qdrant                   | Store and retrieve brand embeddings |
| `@qdrant/js-client-rest` | Qdrant Node.js client               |

### Frontend

| Tool           | Version          | Purpose                 |
| -------------- | ---------------- | ----------------------- |
| Next.js        | 14+ (App Router) | Dashboard UI            |
| React          | 18               | Component framework     |
| Tailwind CSS   | 3.x              | Styling                 |
| shadcn/ui      | latest           | UI components           |
| TanStack Query | 5.x              | Server state management |
| Recharts       | 2.x              | Analytics charts        |
| `next-auth`    | 5.x              | Auth session management |

### Infrastructure

| Tool                    | Purpose                               |
| ----------------------- | ------------------------------------- |
| Docker + Docker Compose | Local and production containerization |
| PostgreSQL 15           | Relational database                   |
| Redis 7                 | BullMQ queue backend                  |
| Qdrant (Docker image)   | Vector store                          |
| DigitalOcean / AWS      | Cloud hosting                         |
| Nginx                   | Reverse proxy                         |
| GitHub Actions          | CI/CD                                 |

### Third-Party APIs

| API                       | Purpose                                                             |
| ------------------------- | ------------------------------------------------------------------- |
| social-mcp (npm package)  | Unified social media posting layer via MCP tools                    |
| X (Twitter) API v2        | Direct posting fallback                                             |
| Instagram Graph API       | Direct posting fallback                                             |
| LinkedIn API v2           | Direct posting fallback                                             |
| Telegram Bot API          | Telegram community management                                       |
| Google Gemini API         | Primary LLM — Strategist (Pro), Copywriter (Flash), Reviewer (Flash-8B), brand extraction |
| OpenAI API                | Embeddings (text-embedding-3-small) + DALL-E 3 image generation     |
| Anthropic API (Claude)    | LLM fallback via `generateWithFallback()` in `llm-client.ts`        |
| DALL-E 3 API              | Image asset generation                                              |
| Midjourney API (optional) | Premium image asset generation                                      |
| **Stripe API**            | Subscription billing, usage-based overage invoicing, webhook events |
| **Paystack API**          | Alternative payment gateway (NG/Africa market)                      |

---

## 4. Directory Structure

See [docs/structure.md](structure.md) for the full annotated directory tree.

### Summary

```
anthyx/
├── api/          # Express API server + all in-process BullMQ workers (primary backend)
├── services/
│   ├── ingestor/      # Standalone brand ingestion worker (BullMQ consumer)
│   ├── agent/         # Standalone plan + content workers (disabled in compose — see note below)
│   └── mcp/           # fastmcp SSE server on port 3100
├── frontend/          # Next.js 14 dashboard (moved from apps/dashboard)
├── packages/
│   ├── types/         # Shared TypeScript interfaces
│   ├── config/        # Zod schemas, productConfig, CREDIT_COSTS
│   └── queue-contracts/ # BullMQ payload types shared between services
├── docker-compose.yml
└── turbo.json
```

> **Note on `services/agent`:** The standalone agent service exists but is commented out in `docker-compose.yml`. It competes with the `api` worker process on the same BullMQ queues. Re-enable it only after migrating the `api` workers to use it exclusively.

---

## 5. Database Schema

### PostgreSQL (Drizzle ORM)

```typescript
// db/schema.ts

import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core";

// ── Enums ──────────────────────────────────────────────────────────

export const platformEnum = pgEnum("platform", [
  "x",
  "instagram",
  "linkedin",
  "facebook",
  "telegram",
  "tiktok",
  "discord",
  "whatsapp",
  "slack",
  "reddit",
  "threads",
  "bluesky",
  "mastodon",
  "youtube",
]);

export const postStatusEnum = pgEnum("post_status", [
  "draft",
  "pending_review",
  "approved",
  "scheduled",
  "published",
  "failed",
  "vetoed",
  "silenced",
]);

export const planStatusEnum = pgEnum("plan_status", [
  "generating",
  "pending_review",
  "active",
  "completed",
  "paused",
]);

// ── Organizations ──────────────────────────────────────────────────

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── Users ──────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id),
  email: text("email").notNull().unique(),
  name: text("name"),
  role: text("role").notNull().default("member"), // 'owner' | 'admin' | 'member'
  createdAt: timestamp("created_at").defaultNow(),
});

// ── Brand Profiles ─────────────────────────────────────────────────

export const brandProfiles = pgTable("brand_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  name: text("name").notNull(),
  industry: text("industry"),
  // Voice & Tone
  voiceTraits: jsonb("voice_traits"), // { professional: true, witty: false, ... }
  toneDescriptors: text("tone_descriptors").array(), // ["authoritative", "warm", ...]
  // Visual Identity
  primaryColors: text("primary_colors").array(), // ["#0D9488", "#1E293B"]
  secondaryColors: text("secondary_colors").array(),
  typography: jsonb("typography"), // { primary: "Inter", secondary: "Georgia" }
  // Qdrant reference
  qdrantCollectionId: text("qdrant_collection_id").unique(),
  // Raw source metadata
  sourceFiles: jsonb("source_files"), // [{ type: 'pdf', name: 'brandbook.pdf', url: '...' }]
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── Agents (Personas) ──────────────────────────────────────────────

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  brandProfileId: uuid("brand_profile_id")
    .references(() => brandProfiles.id)
    .notNull(),
  name: text("name").notNull(), // "Sales Hunter", "Community Manager"
  description: text("description"),
  // Diet Instructions — behavioral overrides
  dietInstructions: text("diet_instructions"), // "Only post on Tuesdays, never use emojis"
  systemPromptOverride: text("system_prompt_override"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── Social Accounts ────────────────────────────────────────────────

export const socialAccounts = pgTable("social_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  agentId: uuid("agent_id").references(() => agents.id), // assigned agent
  platform: platformEnum("platform").notNull(),
  accountHandle: text("account_handle").notNull(),
  accountId: text("account_id"), // platform-native account ID
  // Encrypted OAuth tokens (encrypt before storing)
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  // Platform config
  platformConfig: jsonb("platform_config"), // rate limit context, audience size, etc.
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── Marketing Plans ────────────────────────────────────────────────

export const marketingPlans = pgTable("marketing_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  brandProfileId: uuid("brand_profile_id")
    .references(() => brandProfiles.id)
    .notNull(),
  agentId: uuid("agent_id").references(() => agents.id),
  name: text("name").notNull(),
  status: planStatusEnum("status").default("generating"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  // AI generation metadata
  generationPrompt: text("generation_prompt"),
  industryContext: text("industry_context"),
  goals: text("goals").array(), // ["increase engagement", "drive traffic"]
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── Scheduled Posts ────────────────────────────────────────────────

export const scheduledPosts = pgTable("scheduled_posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  planId: uuid("plan_id")
    .references(() => marketingPlans.id)
    .notNull(),
  socialAccountId: uuid("social_account_id")
    .references(() => socialAccounts.id)
    .notNull(),
  agentId: uuid("agent_id")
    .references(() => agents.id)
    .notNull(),
  // Content
  contentText: text("content_text").notNull(),
  contentHashtags: text("content_hashtags").array(),
  mediaUrls: text("media_urls").array(), // generated asset URLs
  // Scheduling
  scheduledAt: timestamp("scheduled_at").notNull(),
  status: postStatusEnum("status").default("draft"),
  // BullMQ tracking
  bullJobId: text("bull_job_id"),
  // Execution result
  publishedAt: timestamp("published_at"),
  platformPostId: text("platform_post_id"), // ID returned from platform API
  errorMessage: text("error_message"),
  // HITL
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── Engagement Analytics ───────────────────────────────────────────

export const postAnalytics = pgTable("post_analytics", {
  id: uuid("id").primaryKey().defaultRandom(),
  postId: uuid("post_id")
    .references(() => scheduledPosts.id)
    .notNull(),
  fetchedAt: timestamp("fetched_at").defaultNow(),
  likes: integer("likes").default(0),
  reposts: integer("reposts").default(0),
  comments: integer("comments").default(0),
  impressions: integer("impressions").default(0),
  clicks: integer("clicks").default(0),
  engagementRate: text("engagement_rate"), // stored as string decimal
  rawData: jsonb("raw_data"), // full platform response
});
```

### Qdrant Collections

```
Collection: brand_{brandProfileId}
  → Vector size: 1536 (OpenAI text-embedding-3-small)
  → Distance: Cosine

Payload schema per point:
{
  "id": "uuid",
  "type": "voice_rule" | "tone_descriptor" | "color_reference" | "brand_statement" | "audience_note",
  "text": "Original extracted text chunk",
  "source": "brandbook_page_3",
  "organizationId": "uuid"
}
```

### Subscription & Billing Tables

```typescript
// ── Plan Tiers (seeded, not user-created) ─────────────────────────

export const planTierEnum = pgEnum("plan_tier", [
  "sandbox",
  "starter",
  "growth",
  "agency",
  "scale",
  "enterprise",
]);

export const billingIntervalEnum = pgEnum("billing_interval", [
  "monthly",
  "annual",
]);

export const planTiers = pgTable("plan_tiers", {
  id: uuid("id").primaryKey().defaultRandom(),
  tier: planTierEnum("tier").notNull().unique(),
  displayName: text("display_name").notNull(), // "Growth"
  monthlyPrice: integer("monthly_price").notNull(), // in cents, e.g. 14900
  annualPrice: integer("annual_price").notNull(), // in cents (20% discount)
  // Hard limits enforced at runtime
  maxBrands: integer("max_brands").notNull(), // -1 = unlimited
  maxAgents: integer("max_agents").notNull(),
  maxSocialAccounts: integer("max_social_accounts").notNull(),
  maxPostsPerMonth: integer("max_posts_per_month").notNull(),
  // Feature flags
  autonomousScheduling: boolean("autonomous_scheduling").default(false),
  feedbackLoop: boolean("feedback_loop").default(false),
  aiAssetGeneration: boolean("ai_asset_generation").default(false),
  ipRotation: boolean("ip_rotation").default(false),
  whiteLabel: boolean("white_label").default(false),
  assetWatermark: boolean("asset_watermark").default(true), // Sandbox only
  hitlRequired: boolean("hitl_required").default(false), // Sandbox only
  // Overage rates
  overagePricePerPost: integer("overage_price_per_post").default(4), // $0.04 in cents
  overagePricePerAccount: integer("overage_price_per_account").default(800), // $8.00
  overagePricePerBrand: integer("overage_price_per_brand").default(2500), // $25.00
});

// ── Subscriptions ─────────────────────────────────────────────────

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull()
    .unique(),
  tier: planTierEnum("tier").notNull().default("sandbox"),
  billingInterval: billingIntervalEnum("billing_interval").default("monthly"),
  // Stripe
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripePriceId: text("stripe_price_id"),
  // Status
  status: text("status").default("active"), // 'active' | 'past_due' | 'cancelled' | 'trialing'
  trialEndsAt: timestamp("trial_ends_at"),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelledAt: timestamp("cancelled_at"),
  // Overage cap (user-configurable)
  overageCapCents: integer("overage_cap_cents").default(5000), // $50 default hard cap
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── Usage Tracking (metered per billing period) ───────────────────

export const usageRecords = pgTable("usage_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  billingPeriodStart: timestamp("billing_period_start").notNull(),
  billingPeriodEnd: timestamp("billing_period_end").notNull(),
  postsPublished: integer("posts_published").default(0),
  postsIncluded: integer("posts_included").notNull(), // from plan tier
  postsOverage: integer("posts_overage").default(0), // posts beyond limit
  accountsConnected: integer("accounts_connected").default(0),
  accountsIncluded: integer("accounts_included").notNull(),
  accountsOverage: integer("accounts_overage").default(0),
  brandsActive: integer("brands_active").default(0),
  brandsIncluded: integer("brands_included").notNull(),
  brandsOverage: integer("brands_overage").default(0),
  // Calculated overage cost in cents
  overageCostCents: integer("overage_cost_cents").default(0),
  overageInvoiced: boolean("overage_invoiced").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

---

## 6. Brand Ingestion Pipeline

### Flow

```
Input (PDF | MD | URL)
        │
        ▼
┌──────────────────────────────┐
│  1. Parse Raw Content        │
│  - pdf-parse (PDF)           │
│  - fs.readFile (Markdown)    │
│  - cheerio scrape (URL)      │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│  2. NLP Extraction (LLM)     │
│  Prompt extracts:            │
│  - Brand voice traits        │
│  - Tone descriptors          │
│  - Primary/secondary colors  │
│  - Industry/positioning      │
│  - Typography preferences    │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│  3. Chunk + Embed            │
│  - Split into ~500 token     │
│    chunks with 50 token      │
│    overlap                   │
│  - Embed via OpenAI          │
│    text-embedding-3-small    │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│  4. Store                    │
│  - Points → Qdrant           │
│  - Metadata → PostgreSQL     │
│    brandProfiles table       │
└──────────────────────────────┘
```

### Extraction Prompt Template

```typescript
// services/brand-ingestion/extractor.ts

const EXTRACTION_PROMPT = `
You are a brand analyst. Analyze the following brand document and extract structured data.

Return ONLY valid JSON in this exact format:
{
  "industry": "string",
  "voiceTraits": {
    "professional": boolean,
    "witty": boolean,
    "aggressive": boolean,
    "empathetic": boolean,
    "authoritative": boolean,
    "casual": boolean
  },
  "toneDescriptors": ["string"],
  "primaryColors": ["#hexcode"],
  "secondaryColors": ["#hexcode"],
  "typography": {
    "primary": "font name or null",
    "secondary": "font name or null"
  },
  "brandStatements": ["key brand messages, max 5"],
  "audienceNotes": ["target audience descriptors, max 3"]
}

Document:
{documentText}
`;
```

### Chunking Strategy

```typescript
// services/brand-ingestion/embedder.ts

function chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let i = 0;
  while (i < words.length) {
    chunks.push(words.slice(i, i + chunkSize).join(" "));
    i += chunkSize - overlap;
  }
  return chunks;
}

async function embedAndStore(
  chunks: string[],
  brandProfileId: string,
  metadata: ChunkMetadata,
): Promise<void> {
  const embeddings = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: chunks,
  });

  const points = embeddings.data.map((e, i) => ({
    id: crypto.randomUUID(),
    vector: e.embedding,
    payload: {
      text: chunks[i],
      brandProfileId,
      ...metadata,
    },
  }));

  await qdrant.upsert(`brand_${brandProfileId}`, { points });
}
```

---

## 7. Multi-Agent Orchestration (MCP)

### Agent Topology

Anthyx uses **three specialized sub-agents** coordinated by an MCP orchestrator. Each agent is a separate LLM call with its own system prompt, tools, and narrow responsibility. They are never merged into a single prompt.

```
Orchestrator (MCP Server)
        │
        ├──► Strategist Agent   ← Claude Opus  (plan generation + feedback loop)
        ├──► Copywriter Agent   ← Claude Sonnet (post content per platform)
        └──► Reviewer Agent     ← Claude Haiku  (compliance gate — adversarial)
```

### MCP Server Setup

```typescript
// mcp/server.ts

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({
  name: "anthyx-agent-server",
  version: "1.0.0",
});

// Strategist tools
server.tool("retrieve_brand_context", retrieveBrandContextTool);
server.tool("web_search_trends", webSearchTrendsTool);
server.tool("read_engagement_analytics", readEngagementAnalyticsTool);

// Copywriter tools
server.tool("retrieve_brand_voice", retrieveBrandVoiceTool);
server.tool("generate_image_asset", generateImageAssetTool);

// Reviewer tools
server.tool("retrieve_diet_instructions", retrieveDietInstructionsTool);
server.tool("retrieve_brand_rules", retrieveBrandRulesTool);

// Shared
server.tool("schedule_post", schedulePostTool);

const transport = new StdioServerTransport();
await server.connect(transport);
```

### MCP Tool Definitions

#### `retrieve_brand_context`

```typescript
// Input:  { brandProfileId: string, query: string, topK?: number }
// Action: Semantic search in Qdrant — ALWAYS filtered by brandProfileId (tenant isolation)
// Output: { chunks: BrandChunk[], voiceTraits: VoiceTraits, colors: string[] }
// Used by: Strategist, Copywriter
```

#### `web_search_trends`

```typescript
// Input:  { industry: string, keywords: string[], timeframe: '7d' | '30d' }
// Action: Web search for recent industry news and trending topics
// Output: { trends: Trend[], relevantTopics: string[] }
// Used by: Strategist
```

#### `read_engagement_analytics`

```typescript
// Input:  { brandProfileId: string, lookbackDays: number }
// Action: Reads postAnalytics table, aggregates by platform + contentType
// Output: { topPerformers: PostSummary[], lowPerformers: PostSummary[], avgEngagementRate: number }
// Used by: Strategist (feedback loop)
```

#### `retrieve_brand_voice`

```typescript
// Input:  { brandProfileId: string, topic: string }
// Action: Targeted Qdrant search for voice/tone chunks relevant to this post's topic
// Output: { voiceRules: string[], toneDescriptors: string[], examplePhrasing: string[] }
// Used by: Copywriter
```

#### `generate_image_asset`

```typescript
// Input:  { prompt: string, brandColors: string[], aspectRatio: '1:1' | '16:9' }
// Action: Injects hex codes into prompt → DALL-E 3 → CDN upload
// Output: { imageUrl: string, revisedPrompt: string }
// Used by: Copywriter
```

#### `retrieve_diet_instructions`

```typescript
// Input:  { agentId: string }
// Action: Fetches agent's dietInstructions and systemPromptOverride from PostgreSQL
// Output: { instructions: string, prohibitions: string[] }
// Used by: Reviewer
```

#### `schedule_post`

```typescript
// Input:  { postId: string, scheduledAt: ISO8601 }
// Action: Creates BullMQ job with calculated delay
// Output: { jobId: string, scheduledAt: string }
// Used by: Orchestrator (after Reviewer passes)
```

---

### Agent 1: The Strategist

**Responsibility:** Generates the 30-day marketing plan. Consumes brand knowledge and real-world trends. Adjusts strategy based on engagement analytics (feedback loop).

```typescript
// services/agent/strategist.ts

const STRATEGIST_SYSTEM_PROMPT = `
You are a senior digital marketing strategist.
You generate data-driven, brand-aligned 30-day marketing calendars.
You have access to tools to retrieve brand context, search for industry trends,
and read past engagement performance.

Rules:
- Every plan item must map to a content pillar: educational | promotional | engagement | trending
- Prioritize content types that historically performed well (use read_engagement_analytics)
- Never generate more than 2 promotional posts per 7-day window
- Distribute platforms based on the brand's active accounts
- Output must be valid JSON matching the GeneratedPlanItem schema
`.trim();

async function runStrategistAgent(
  input: StrategistInput,
): Promise<GeneratedPlanItem[]> {
  const messages: MessageParam[] = [
    {
      role: "user",
      content: `
      Generate a 30-day marketing calendar for:
      Brand: ${input.brandName}
      Industry: ${input.industry}
      Goals: ${input.goals.join(", ")}
      Active platforms: ${input.platforms.join(", ")}
      Start date: ${input.startDate}
      
      Use your tools to retrieve brand context, search for current trends in ${input.industry},
      and read engagement analytics to inform the strategy.
      
      Return a JSON array of plan items.
    `,
    },
  ];

  // Agentic loop — Strategist uses tools until it has enough context
  let response = await claude.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 8096,
    system: STRATEGIST_SYSTEM_PROMPT,
    tools: [
      retrieveBrandContextTool,
      webSearchTrendsTool,
      readEngagementAnalyticsTool,
    ],
    messages,
  });

  while (response.stop_reason === "tool_use") {
    const toolResults = await executeToolCalls(response.content);
    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: toolResults });
    response = await claude.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 8096,
      system: STRATEGIST_SYSTEM_PROMPT,
      tools: [
        retrieveBrandContextTool,
        webSearchTrendsTool,
        readEngagementAnalyticsTool,
      ],
      messages,
    });
  }

  const raw = extractJsonFromResponse(response.content);
  return PlanItemArraySchema.parse(raw); // Zod validation
}
```

---

### Agent 2: The Copywriter

**Responsibility:** Takes a single plan item and writes the final post for a specific platform and persona. Retrieves brand voice from Qdrant RAG. Returns structured output for the Reviewer.

```typescript
// services/agent/copywriter.ts

function buildCopywriterPrompt(ctx: CopywriterContext): string {
  return `
You are ${ctx.personaName}, a social media copywriter for ${ctx.brandName}.

## Brand Voice Rules (retrieved from brand memory)
${ctx.brandVoiceRules}

## Your Persona Instructions (Diet Instructions)
${ctx.dietInstructions}

## Platform: ${ctx.platform.toUpperCase()}
${getPlatformConstraints(ctx.platform)}

## Assignment
Write a single post for the following plan item:
- Topic: ${ctx.topic}
- Content Pillar: ${ctx.contentType}
- Hook suggestion: ${ctx.hook}
- CTA: ${ctx.cta}
- Scheduled date: ${ctx.scheduledAt}

## Output (return ONLY valid JSON, no prose)
{
  "content": "final post text",
  "hashtags": ["tag1", "tag2"],
  "suggestedMediaPrompt": "DALL-E prompt if visual needed, otherwise null",
  "reasoning": "1-2 sentence explanation of creative choices"
}
`.trim();
}

function getPlatformConstraints(platform: Platform): string {
  const constraints: Record<Platform, string> = {
    x: "Hard limit: 280 characters including spaces. 1–2 hashtags max. Hook must land in first 8 words.",
    instagram:
      "Caption up to 2,200 characters. Visual-first framing. Save hashtags (20–30) for first comment, not caption.",
    linkedin:
      "Professional register. Thought leadership angle. 1,300 character soft limit for full display. Max 3 hashtags inline.",
    telegram:
      "Conversational, community-first. Markdown formatting supported. No character limit.",
    facebook:
      "Emotional engagement. 80 characters ideal for reach but up to 400 acceptable. 1–3 hashtags.",
    tiktok:
      'Hook in first 3 words — this is the caption shown before "more". Trend-aware. 3–5 hashtags.',
  };
  return constraints[platform];
}
```

---

### Agent 3: The Reviewer (Compliance Gate)

**Responsibility:** Acts as an adversarial quality gate. Receives the Copywriter's output and checks it independently against brand rules and diet instructions. This is a **separate LLM call** — the Reviewer has no context of the Copywriter's reasoning, only the output.

```typescript
// services/agent/reviewer.ts

const REVIEWER_SYSTEM_PROMPT = `
You are a strict brand compliance reviewer.
Your only job is to evaluate whether a social media post passes or fails against 
the provided brand rules and agent diet instructions.
You are adversarial — err on the side of rejection if in doubt.
You have no attachment to the post you are reviewing.
`.trim();

interface ReviewerInput {
  postContent: string;
  hashtags: string[];
  platform: Platform;
  brandRules: string; // from Qdrant
  dietInstructions: string; // from agents table
  platformConstraints: string;
}

interface ReviewerOutput {
  verdict: "pass" | "fail" | "rewrite";
  issues: string[]; // list of specific violations
  revisedContent?: string; // populated only on 'rewrite'
  revisedHashtags?: string[];
}

async function runReviewerAgent(input: ReviewerInput): Promise<ReviewerOutput> {
  const response = await claude.messages.create({
    model: "claude-haiku-4-5-20251001", // fast + cheap for compliance checks
    max_tokens: 1024,
    system: REVIEWER_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `
Review this post:

POST CONTENT:
"${input.postContent}"

HASHTAGS: ${input.hashtags.join(", ")}

PLATFORM RULES:
${input.platformConstraints}

BRAND RULES:
${input.brandRules}

AGENT DIET INSTRUCTIONS:
${input.dietInstructions}

Return ONLY valid JSON:
{
  "verdict": "pass" | "fail" | "rewrite",
  "issues": ["specific issue 1", "specific issue 2"],
  "revisedContent": "corrected post text if verdict is rewrite, else null",
  "revisedHashtags": ["tag1"] or null
}
      `,
      },
    ],
  });

  const raw = extractJsonFromResponse(response.content);
  return ReviewerOutputSchema.parse(raw);
}
```

### Orchestrator: Full Content Generation Loop

```typescript
// services/agent/orchestrator.ts

const MAX_REVIEW_RETRIES = 2;

async function generateAndReviewPost(
  planItem: GeneratedPlanItem,
  agent: Agent,
  account: SocialAccount,
  brandProfile: BrandProfile,
): Promise<{
  content: string;
  hashtags: string[];
  mediaPrompt: string | null;
}> {
  // Step 1: Copywriter generates post
  const brandVoice = await retrieveBrandVoiceFromQdrant(
    brandProfile.id,
    planItem.topic,
  );
  const draft = await runCopywriterAgent({
    personaName: agent.name,
    brandName: brandProfile.name,
    brandVoiceRules: brandVoice,
    dietInstructions: agent.dietInstructions,
    platform: account.platform,
    ...planItem,
  });

  // Step 2: Reviewer acts as compliance gate
  let reviewInput = {
    postContent: draft.content,
    hashtags: draft.hashtags,
    platform: account.platform,
    brandRules: brandVoice,
    dietInstructions: agent.dietInstructions,
    platformConstraints: getPlatformConstraints(account.platform),
  };

  let retries = 0;
  while (retries <= MAX_REVIEW_RETRIES) {
    const review = await runReviewerAgent(reviewInput);

    if (review.verdict === "pass") {
      await logAgentAction(planItem.id, "reviewer_pass", { retries });
      return {
        content: reviewInput.postContent,
        hashtags: reviewInput.hashtags,
        mediaPrompt: draft.suggestedMediaPrompt,
      };
    }

    if (review.verdict === "rewrite" && review.revisedContent) {
      // Use reviewer's correction, loop once more to verify
      reviewInput = {
        ...reviewInput,
        postContent: review.revisedContent,
        hashtags: review.revisedHashtags ?? reviewInput.hashtags,
      };
      retries++;
      continue;
    }

    if (review.verdict === "fail") {
      await logAgentAction(planItem.id, "reviewer_fail", {
        issues: review.issues,
      });
      throw new ReviewerRejectionError(
        `Post failed compliance: ${review.issues.join("; ")}`,
      );
    }
  }

  throw new ReviewerRejectionError("Exceeded max review retries");
}
```

### Account + Tenant Isolation

**Rule:** Every Qdrant query **must** include a `must` filter on `brandProfileId`. The orchestrator enforces this — no raw Qdrant calls allowed outside of the brand context retrieval service.

```typescript
// services/agent/brand-context.ts

async function retrieveBrandVoiceFromQdrant(
  brandProfileId: string,
  query: string,
  topK = 8,
): Promise<string> {
  const results = await qdrant.search(`brand_${brandProfileId}`, {
    vector: await embed(query),
    limit: topK,
    filter: {
      must: [
        { key: "brandProfileId", match: { value: brandProfileId } }, // TENANT ISOLATION
        {
          key: "type",
          match: { any: ["voice_rule", "tone_descriptor", "brand_statement"] },
        },
      ],
    },
  });
  return results.map((r) => r.payload?.text).join("\n");
}
```

---

### OAuth Proxy Service

Rather than decrypting tokens inline in the post worker, all social auth is handled by a **dedicated OAuth Proxy service**. Workers call this service to get a valid, refreshed token — they never touch the encryption logic directly.

```typescript
// services/oauth-proxy/index.ts

export class OAuthProxyService {
  async getValidToken(socialAccountId: string): Promise<string> {
    const account = await db.query.socialAccounts.findFirst({
      where: eq(socialAccounts.id, socialAccountId),
    });
    if (!account) throw new Error("Social account not found");

    // Check if token is expired or expiring within 5 minutes
    const expiresAt = account.tokenExpiresAt?.getTime() ?? 0;
    const needsRefresh = expiresAt - Date.now() < 5 * 60 * 1000;

    if (needsRefresh) {
      return this.refreshToken(account);
    }

    return decryptToken(account.accessToken!);
  }

  private async refreshToken(account: SocialAccount): Promise<string> {
    const refreshToken = decryptToken(account.refreshToken!);
    const newTokens = await PLATFORM_REFRESHERS[account.platform](refreshToken);

    await db
      .update(socialAccounts)
      .set({
        accessToken: encryptToken(newTokens.accessToken),
        refreshToken: encryptToken(newTokens.refreshToken ?? refreshToken),
        tokenExpiresAt: new Date(Date.now() + newTokens.expiresIn * 1000),
        updatedAt: new Date(),
      })
      .where(eq(socialAccounts.id, account.id));

    await logAgentAction(account.id, "token_refreshed", {
      platform: account.platform,
    });
    return newTokens.accessToken;
  }
}

// Post worker usage — clean, no crypto logic here
const token = await oauthProxy.getValidToken(socialAccountId);
await publishToplatform(platform, { token, content, mediaUrls });
```

---

## 8. Marketing Plan Engine

### 30-Day Plan Generation Flow

```
Input: { brandProfileId, agentId, platforms[], goals[], startDate }
        │
        ▼
Retrieve brand context (Qdrant RAG)
        │
        ▼
Fetch industry trends (web search tool or curated context)
        │
        ▼
Build planner prompt with:
  - Brand voice rules
  - Platform-specific cadence recommendations
  - Content pillars (educational, promotional, engagement, viral)
  - User goals
        │
        ▼
Call Claude to generate structured 30-day calendar
  → Returns array of { date, platform, topic, contentType, hook, cta }
        │
        ▼
Store MarketingPlan + individual ScheduledPost records (status: 'draft')
        │
        ▼
HITL: User reviews/edits/approves entire plan or individual posts
        │
        ▼
Approved posts → generate full content per post (MCP agent)
        │
        ▼
BullMQ jobs created for each approved post
```

### Plan Schema (JSON output from LLM)

```typescript
interface GeneratedPlanItem {
  date: string; // ISO8601
  platform: Platform;
  contentType:
    | "educational"
    | "promotional"
    | "engagement"
    | "trending"
    | "user_generated";
  topic: string;
  hook: string; // opening line suggestion
  cta: string; // call to action
  suggestVisual: boolean;
  notes?: string;
}
```

---

## 9. Task Queue & Scheduler (BullMQ)

### Queue Architecture

```
Queues:
  anthyx:post-execution      # publish approved posts at scheduled time
  anthyx:plan-generation     # generate 30-day plans
  anthyx:content-generation  # generate individual post content
  anthyx:asset-generation    # generate images
  anthyx:analytics           # fetch engagement data post-publish
```

### Post Execution Worker

```typescript
// workers/post.worker.ts

import { Worker, Job } from "bullmq";

interface PostJobData {
  postId: string;
  socialAccountId: string;
  platform: Platform;
}

const worker = new Worker<PostJobData>(
  "anthyx:post-execution",
  async (job: Job<PostJobData>) => {
    const { postId, socialAccountId, platform } = job.data;

    const post = await db.query.scheduledPosts.findFirst({
      where: eq(scheduledPosts.id, postId),
    });

    if (!post || post.status !== "approved") {
      throw new Error(`Post ${postId} is not in approved state`);
    }

    // Generate image if needed
    let mediaUrls = post.mediaUrls ?? [];
    if (post.contentText.includes("[GENERATE_IMAGE]")) {
      const asset = await generateImageAsset(post, platform);
      mediaUrls = [asset.imageUrl];
    }

    // Publish
    const result = await publishToplatform(platform, {
      accountId: socialAccountId,
      content: post.contentText,
      hashtags: post.contentHashtags ?? [],
      mediaUrls,
    });

    // Update DB
    await db
      .update(scheduledPosts)
      .set({
        status: "published",
        publishedAt: new Date(),
        platformPostId: result.postId,
      })
      .where(eq(scheduledPosts.id, postId));

    // Queue analytics fetch 30min later
    await analyticsQueue.add(
      "fetch-analytics",
      { postId },
      { delay: 30 * 60 * 1000 },
    );
  },
  {
    connection: redisConnection,
    concurrency: 10, // 10 simultaneous post executions
    limiter: {
      max: 100, // max 100 jobs per 60s (rate limit safety)
      duration: 60_000,
    },
  },
);

worker.on("failed", async (job, err) => {
  if (job) {
    await db
      .update(scheduledPosts)
      .set({ status: "failed", errorMessage: err.message })
      .where(eq(scheduledPosts.id, job.data.postId));
  }
});
```

### Scheduling a Post

```typescript
// queue/jobs.ts

export async function schedulePostJob(
  postId: string,
  scheduledAt: Date,
): Promise<string> {
  const delay = scheduledAt.getTime() - Date.now();
  if (delay < 0) throw new Error("Cannot schedule post in the past");

  const job = await postExecutionQueue.add(
    "execute-post",
    { postId },
    {
      delay,
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { age: 86400 }, // keep completed jobs 24h
      removeOnFail: { age: 604800 }, // keep failed jobs 7d
    },
  );

  await db
    .update(scheduledPosts)
    .set({ bullJobId: job.id, status: "scheduled" })
    .where(eq(scheduledPosts.id, postId));

  return job.id!;
}
```

---

## 10. Social Platform Integrations

### Unified Approach (Recommended)

Use **social-mcp API** as the primary posting layer. This reduces SDK surface area to one HTTP client and handles X, Instagram, LinkedIn, Facebook, TikTok, and Telegram under a single auth model.

```typescript
// services/posting/social-mcp.ts
// social-mcp exposes social platform posting as MCP tools.
// The post worker calls these tools via the MCP client — never directly.

import { getMcpClient } from "../agent/mcp-client";

export async function publishPost(params: {
  platform: Platform;
  post: string;
  mediaUrls?: string[];
  accessToken: string; // decrypted via OAuthProxyService
}): Promise<SocialMcpResponse> {
  const client = getMcpClient();

  const result = await client.callTool({
    name: `post_to_${params.platform}`, // e.g. post_to_twitter, post_to_linkedin
    arguments: {
      content: params.post,
      media_urls: params.mediaUrls ?? [],
      access_token: params.accessToken,
    },
  });

  return result as SocialMcpResponse;
}
```

### Direct API Fallbacks

| Platform    | Auth                 | Key Limits                                                     |
| ----------- | -------------------- | -------------------------------------------------------------- |
| X (Twitter) | OAuth 2.0 PKCE       | 50 posts/24h (Free tier), 1500/month (Basic)                   |
| Instagram   | Meta Graph API OAuth | Business/Creator accounts only, 200 API calls/hour             |
| LinkedIn    | OAuth 2.0            | 500 API calls/day, must use organization URN for company pages |
| Telegram    | Bot Token            | No hard rate limit; 30 messages/second per bot                 |

### Rate Limit Strategy

```typescript
// Each platform has a rate limit budget tracked in Redis
// Key: ratelimit:{organizationId}:{platform}
// Value: { count: number, resetAt: ISO8601 }

async function checkAndDecrementRateLimit(
  orgId: string,
  platform: Platform,
): Promise<boolean> {
  const key = `ratelimit:${orgId}:${platform}`;
  const budget = PLATFORM_BUDGETS[platform]; // { max, windowMs }
  const current = await redis.get(key);

  if (!current) {
    await redis.set(
      key,
      JSON.stringify({ count: 1, resetAt: Date.now() + budget.windowMs }),
      "PX",
      budget.windowMs,
    );
    return true;
  }

  const { count, resetAt } = JSON.parse(current);
  if (count >= budget.max) return false; // reject, will retry later

  await redis.set(
    key,
    JSON.stringify({ count: count + 1, resetAt }),
    "PXAT",
    resetAt,
  );
  return true;
}
```

---

## 11. Asset Generation Pipeline

Anthyx uses a **dual-track** asset generation strategy. Template-based rendering is fast, cheap, and brand-consistent at scale. DALL-E is reserved for creative/contextual assets where a template won't do.

```
Post content generated
        │
        ▼
Does post need a visual?
  (suggestedMediaPrompt != null)
        │
        ▼
Which track?
  ┌─────────────────────────┬──────────────────────────────┐
  │  TRACK A: Template      │  TRACK B: AI-Generated       │
  │  (preferred at scale)   │  (contextual/unique)         │
  │                         │                              │
  │  BannerBear or          │  DALL-E 3                    │
  │  Cloudinary             │  + brand color injection     │
  │  Brand-color templates  │                              │
  │  Fast: ~1–3s            │  Slower: ~10–20s             │
  │  Cheap: ~$0.001/image   │  Expensive: ~$0.04/image     │
  └─────────────────────────┴──────────────────────────────┘
        │                              │
        ▼                              ▼
  Return rendered card          Return AI image URL
        │                              │
        └──────────────┬───────────────┘
                       ▼
              Upload to CDN (S3 / DO Spaces)
                       │
                       ▼
        CDN URL → stored in scheduledPosts.mediaUrls
```

### Track A: Template-Based Cards (BannerBear / Cloudinary)

Use pre-designed social card templates populated with brand colors, post text, and logo at render time. This is the **default track** for all promotional and announcement posts.

```typescript
// services/assets/template-renderer.ts

const BANNERBEAR_API = "https://api.bannerbear.com/v2";

interface TemplateRenderParams {
  templateUid: string; // BannerBear template UID (per brand)
  primaryColor: string; // hex e.g. "#0D9488"
  secondaryColor: string;
  headline: string; // max 60 chars
  subtext?: string;
  logoUrl?: string;
  platform: Platform; // determines aspect ratio
}

export async function renderTemplateCard(
  params: TemplateRenderParams,
): Promise<string> {
  const modifications = [
    { name: "background", color: params.primaryColor },
    { name: "accent", color: params.secondaryColor },
    { name: "headline_text", text: params.headline },
    { name: "sub_text", text: params.subtext ?? "" },
    { name: "logo", image_url: params.logoUrl ?? "" },
  ];

  const response = await fetch(`${BANNERBEAR_API}/images`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.BANNERBEAR_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      template: params.templateUid,
      modifications,
      webhook_url: `${process.env.API_URL}/webhooks/bannerbear`, // async delivery
    }),
  });

  const data = await response.json();
  return data.uid; // poll or receive via webhook
}

// Alternative: Cloudinary dynamic image URL (no round-trip needed)
export function buildCloudinaryCardUrl(params: {
  publicId: string; // template base image in Cloudinary
  overlayText: string;
  primaryColor: string;
}): string {
  const color = params.primaryColor.replace("#", "");
  const text = encodeURIComponent(params.overlayText);
  return (
    `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/` +
    `e_colorize,co_rgb:${color}/` +
    `l_text:Arial_40_bold:${text},co_white,g_south,y_40/` +
    `${params.publicId}.png`
  );
}
```

**When to use BannerBear vs. Cloudinary:**

- **BannerBear**: Complex templates with multiple layers, logo placement, precise typography. Best for polished social cards.
- **Cloudinary**: Simple text/color overlays, real-time URL generation with no API call needed. Best for volume at scale.

### Track B: AI-Generated Images (DALL-E 3)

Reserved for posts that need a unique, contextual visual that a template can't capture (e.g., "celebrate our funding round", "new product launch hero image").

```typescript
// services/assets/ai-generator.ts

export async function generateAIAsset(params: {
  prompt: string;
  brandColors: string[];
  aspectRatio?: "1:1" | "16:9";
}): Promise<string> {
  const colorContext = `Primary color: ${params.brandColors[0]}, accent: ${params.brandColors[1] ?? params.brandColors[0]}`;
  const fullPrompt = `${params.prompt}. ${colorContext}. Professional digital marketing visual. Clean, modern aesthetic. No text overlay.`;

  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt: fullPrompt,
    size: params.aspectRatio === "16:9" ? "1792x1024" : "1024x1024",
    quality: "standard",
    n: 1,
  });

  const imageUrl = response.data[0].url!;
  return uploadToCDN(imageUrl);
}
```

### Asset Track Router

```typescript
// services/assets/generator.ts

export async function generateAssetForPost(
  post: ScheduledPost,
  brand: BrandProfile,
): Promise<string | null> {
  if (
    !post.contentText.includes("[GENERATE_IMAGE]") &&
    !post.suggestedMediaPrompt
  ) {
    return null; // no visual needed
  }

  // Copywriter flags template-eligible posts
  const useTemplate =
    post.assetTrack === "template" && brand.bannerBearTemplateUid;

  if (useTemplate) {
    const uid = await renderTemplateCard({
      templateUid: brand.bannerBearTemplateUid!,
      primaryColor: brand.primaryColors[0],
      secondaryColor: brand.secondaryColors?.[0] ?? brand.primaryColors[0],
      headline: extractHeadlineFromPost(post.contentText),
      logoUrl: brand.logoUrl ?? undefined,
      platform: post.platform,
    });
    return pollBannerBearUntilReady(uid); // returns CDN URL
  }

  // Fall back to DALL-E 3
  return generateAIAsset({
    prompt: post.suggestedMediaPrompt ?? "professional marketing visual",
    brandColors: brand.primaryColors,
  });
}
```

**Schema addition:**

```typescript
// Add to scheduledPosts table
assetTrack: text('asset_track').default('template'), // 'template' | 'ai'
suggestedMediaPrompt: text('suggested_media_prompt'),
```

---

## 12. Authentication & Security

### OAuth 2.0 Flow (Social Accounts)

```
User clicks "Connect Account" (platform X)
        │
        ▼
API generates OAuth authorization URL with state param (CSRF protection)
        │
        ▼
User redirected to platform OAuth screen
        │
        ▼
Platform redirects to /api/oauth/callback?code=...&state=...
        │
        ▼
API exchanges code for access + refresh tokens
        │
        ▼
Tokens encrypted with AES-256-GCM before storing in PostgreSQL
(encryption key stored in environment, never in DB)
        │
        ▼
SocialAccount record created/updated
```

### Token Encryption

```typescript
// middleware/crypto.ts

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY!, "hex"); // 32 bytes

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptToken(ciphertext: string): string {
  const [ivHex, tagHex, encHex] = ciphertext.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const encrypted = Buffer.from(encHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final("utf8");
}
```

### API Authentication

- All API routes protected by JWT middleware
- JWTs issued on login, stored as httpOnly cookies
- Organization-level scoping: every DB query includes `organizationId` filter
- Row-level security enforced at the service layer

---

## 12B. Autonomous Feedback Loop (Scoring Algorithm)

The Strategist Agent reads engagement data and adjusts future plan generation. This section defines exactly how that signal is calculated and consumed.

### Engagement Scoring

```typescript
// services/analytics/scorer.ts

interface VoicePerformanceScore {
  voiceTrait: string; // e.g. "educational", "hype", "promotional"
  platform: Platform;
  avgEngagementRate: number; // likes + comments + reposts / impressions
  postCount: number;
  trend: "rising" | "flat" | "declining";
}

export async function computeVoicePerformance(
  brandProfileId: string,
  lookbackDays = 30,
): Promise<VoicePerformanceScore[]> {
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

  // Join posts with their analytics + agent voice trait metadata
  const rows = await db
    .select({
      voiceTrait: scheduledPosts.contentType, // 'educational' | 'promotional' | etc.
      platform: scheduledPosts.platform,
      engagementRate: postAnalytics.engagementRate,
    })
    .from(scheduledPosts)
    .innerJoin(postAnalytics, eq(postAnalytics.postId, scheduledPosts.id))
    .where(
      and(
        eq(scheduledPosts.brandProfileId, brandProfileId),
        eq(scheduledPosts.status, "published"),
        gte(scheduledPosts.publishedAt, since),
      ),
    );

  // Group and average
  const grouped = groupBy(rows, (r) => `${r.voiceTrait}:${r.platform}`);
  return Object.entries(grouped).map(([key, posts]) => {
    const [voiceTrait, platform] = key.split(":");
    const rates = posts.map((p) => parseFloat(p.engagementRate ?? "0"));
    const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
    return {
      voiceTrait,
      platform: platform as Platform,
      avgEngagementRate: avg,
      postCount: posts.length,
      trend: computeTrend(rates), // linear regression on time-series
    };
  });
}

// Threshold: if avg engagement rate for a voice < 0.5%, flag as underperforming
const UNDERPERFORM_THRESHOLD = 0.005;
const OUTPERFORM_MULTIPLIER = 2.0; // 2x avg = top performer

export function classifyVoices(scores: VoicePerformanceScore[]): {
  promote: string[]; // increase frequency
  demote: string[]; // reduce frequency
  cut: string[]; // remove from plan
} {
  const avgOverall =
    scores.reduce((a, s) => a + s.avgEngagementRate, 0) / scores.length;
  return {
    promote: scores
      .filter((s) => s.avgEngagementRate >= avgOverall * OUTPERFORM_MULTIPLIER)
      .map((s) => s.voiceTrait),
    demote: scores
      .filter(
        (s) =>
          s.avgEngagementRate < avgOverall &&
          s.avgEngagementRate >= UNDERPERFORM_THRESHOLD,
      )
      .map((s) => s.voiceTrait),
    cut: scores
      .filter(
        (s) => s.avgEngagementRate < UNDERPERFORM_THRESHOLD && s.postCount >= 5,
      )
      .map((s) => s.voiceTrait),
  };
}
```

### How the Strategist Consumes This

The `read_engagement_analytics` MCP tool calls `computeVoicePerformance()` and `classifyVoices()` and injects the result into the Strategist's context:

```
Feedback signal injected into Strategist prompt:

"Performance data from the last 30 days:
  TOP PERFORMERS (increase frequency):
    - educational content on LinkedIn: 3.2% avg engagement
    - behind-the-scenes on Instagram: 2.8% avg engagement

  UNDERPERFORMERS (reduce frequency):
    - promotional posts on X: 0.3% avg engagement

  CUT (0 frequency in next plan):
    - hype posts on LinkedIn: 0.1% avg engagement (12 posts tested)

Adjust the next 30-day plan to weight content types accordingly."
```

**Guardrail:** The feedback loop only triggers if `plan.feedbackLoopEnabled = true` AND the brand has at least 20 published posts in the lookback window. Insufficient data should not auto-adjust strategy.

---

## 12C. Security — Shadow Ban Protection & IP Rotation

Posting for 1,000+ organizations from a single server IP will trigger automated platform abuse detection. This section covers the distribution strategy.

### The Problem

Social platforms fingerprint post origins. Patterns that trigger shadow-banning or API suspension:

- High-volume posts from a single IP in a short window
- Same User-Agent header across thousands of requests
- Posting at machine-precision intervals (e.g., exactly every 3600s)

### Solution: Distributed Workers with Proxy Routing

```
BullMQ Queue
     │
     ▼
Worker Pool (multiple processes / containers)
     │
     ├── Worker A → Proxy Pool A (Bright Data residential IPs)
     ├── Worker B → Proxy Pool B
     └── Worker C → Proxy Pool C

Each worker is assigned a proxy endpoint. Posts from Org X always
route through the same proxy (consistency) but different orgs use
different proxies (isolation).
```

```typescript
// services/posting/proxy-router.ts

import { HttpsProxyAgent } from "https-proxy-agent";

const BRIGHT_DATA_ENDPOINTS = [
  process.env.BRIGHT_DATA_PROXY_1!, // format: http://user:pass@host:port
  process.env.BRIGHT_DATA_PROXY_2!,
  process.env.BRIGHT_DATA_PROXY_3!,
];

// Deterministic proxy assignment — same org always uses same proxy pool
export function getProxyForOrg(organizationId: string): string {
  const index = hashOrg(organizationId) % BRIGHT_DATA_ENDPOINTS.length;
  return BRIGHT_DATA_ENDPOINTS[index];
}

function hashOrg(orgId: string): number {
  return orgId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

export function buildProxiedAgent(
  organizationId: string,
): HttpsProxyAgent<string> {
  const proxyUrl = getProxyForOrg(organizationId);
  return new HttpsProxyAgent(proxyUrl);
}

// Usage in post executor
const proxyAgent = buildProxiedAgent(post.organizationId);
const response = await fetch(platformApiUrl, {
  method: "POST",
  agent: proxyAgent,
  headers: { Authorization: `Bearer ${token}` },
  body: JSON.stringify(payload),
});
```

### Human-Like Timing Jitter

Never post at machine-precision intervals. Add random jitter to every scheduled post:

```typescript
// queue/jobs.ts

export async function schedulePostJob(
  postId: string,
  scheduledAt: Date,
): Promise<string> {
  // Add ±3 minute random jitter to avoid pattern detection
  const jitterMs = (Math.random() * 6 - 3) * 60 * 1000; // -3 to +3 minutes
  const jitteredTime = new Date(scheduledAt.getTime() + jitterMs);
  const delay = jitteredTime.getTime() - Date.now();

  if (delay < 0) throw new Error("Cannot schedule post in the past");

  const job = await postExecutionQueue.add(
    "execute-post",
    { postId },
    {
      delay,
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
    },
  );

  return job.id!;
}
```

### User-Agent Rotation

```typescript
// services/posting/executor.ts

const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}
```

---

## 12D. Instruction Guardrails (Negative Prompt Layer)

Every agent call — Strategist, Copywriter, and Reviewer — must receive a **Negative Prompt** layer injected before the user-facing instructions. This is an org-level configuration, not a per-agent setting.

### Schema

```typescript
// Add to organizations table in schema.ts
globalProhibitions: text('global_prohibitions').array().default([]),
// e.g. ["never mention competitors", "never use profanity",
//        "never post during Nigerian public holidays"]

sensitiveEventBlackouts: jsonb('sensitive_event_blackouts'),
// e.g. [{ name: "Ramadan", startDate: "2025-03-01", endDate: "2025-03-30" }]
```

### Guardrail Injection

```typescript
// services/agent/guardrails.ts

export interface Guardrails {
  prohibitions: string[];
  activeBlackouts: string[]; // names of active sensitive event windows
}

export async function getActiveGuardrails(
  organizationId: string,
): Promise<Guardrails> {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
  });

  const now = new Date();
  const activeBlackouts = (
    (org?.sensitiveEventBlackouts as SensitiveEvent[]) ?? []
  )
    .filter((e) => new Date(e.startDate) <= now && new Date(e.endDate) >= now)
    .map((e) => e.name);

  return {
    prohibitions: org?.globalProhibitions ?? [],
    activeBlackouts,
  };
}

export function buildGuardrailBlock(guardrails: Guardrails): string {
  const lines: string[] = [
    "## ABSOLUTE PROHIBITIONS (cannot be overridden by any other instruction)",
  ];

  if (guardrails.activeBlackouts.length > 0) {
    lines.push(
      `⛔ ACTIVE BLACKOUT: Do NOT post any content. Current sensitive period: ${guardrails.activeBlackouts.join(", ")}.`,
    );
    lines.push(
      '   If asked to generate content, return an empty result with reason "blackout_period".',
    );
  }

  guardrails.prohibitions.forEach((p) => lines.push(`⛔ ${p}`));

  lines.push("⛔ Never mention specific competitor brand names");
  lines.push("⛔ Never use profanity, slurs, or offensive language");
  lines.push("⛔ Never make unverified factual claims about market data");
  lines.push(
    "⛔ Never post content that could be interpreted as financial advice",
  );

  return lines.join("\n");
}
```

### Injection Point

The guardrail block is injected at the **top of every agent system prompt**, before persona instructions:

```typescript
// services/agent/orchestrator.ts

async function buildSystemPromptWithGuardrails(
  base: string,
  organizationId: string,
): Promise<string> {
  const guardrails = await getActiveGuardrails(organizationId);
  const guardrailBlock = buildGuardrailBlock(guardrails);

  // Guardrails always first — LLMs weight beginning of system prompt more heavily
  return `${guardrailBlock}\n\n---\n\n${base}`;
}
```

### Blackout-Aware Scheduling

If a post's scheduled time falls within an active blackout window, the BullMQ worker should skip (not fail) the post:

```typescript
// workers/post.worker.ts

const guardrails = await getActiveGuardrails(post.organizationId);
if (guardrails.activeBlackouts.length > 0) {
  await db
    .update(scheduledPosts)
    .set({
      status: "vetoed",
      reviewNotes: `Blackout period: ${guardrails.activeBlackouts.join(", ")}`,
    })
    .where(eq(scheduledPosts.id, postId));
  return; // exit cleanly, do not publish
}
```

---

---

## 13. API Reference

### Base URL: `https://api.anthyx.ai/v1`

### Brands

| Method   | Path                 | Description                                 |
| -------- | -------------------- | ------------------------------------------- |
| `POST`   | `/brands`            | Create brand profile                        |
| `POST`   | `/brands/:id/ingest` | Ingest brand document (multipart/form-data) |
| `GET`    | `/brands`            | List brand profiles for org                 |
| `GET`    | `/brands/:id`        | Get brand profile                           |
| `PUT`    | `/brands/:id`        | Update brand profile                        |
| `DELETE` | `/brands/:id`        | Delete brand profile                        |

### Agents

| Method   | Path                  | Description                             |
| -------- | --------------------- | --------------------------------------- |
| `POST`   | `/agents`             | Create agent                            |
| `GET`    | `/agents`             | List agents for org                     |
| `GET`    | `/agents/:id`         | Get agent                               |
| `PUT`    | `/agents/:id`         | Update agent / diet instructions        |
| `DELETE` | `/agents/:id`         | Delete agent                            |
| `POST`   | `/agents/:id/assign`  | Assign agent to social account          |
| `POST`   | `/agents/:id/silence` | Silence agent + cancel all pending jobs |
| `POST`   | `/agents/:id/resume`  | Resume silenced agent                   |

### Social Accounts

| Method   | Path                        | Description             |
| -------- | --------------------------- | ----------------------- |
| `GET`    | `/accounts/oauth/:platform` | Get OAuth URL           |
| `GET`    | `/accounts/oauth/callback`  | OAuth callback handler  |
| `GET`    | `/accounts`                 | List connected accounts |
| `DELETE` | `/accounts/:id`             | Disconnect account      |

### Plans

| Method | Path                 | Description                    |
| ------ | -------------------- | ------------------------------ |
| `POST` | `/plans/generate`    | Trigger 30-day plan generation |
| `GET`  | `/plans`             | List plans                     |
| `GET`  | `/plans/:id`         | Get plan with all posts        |
| `PUT`  | `/plans/:id`         | Update plan settings           |
| `POST` | `/plans/:id/approve` | Approve entire plan            |
| `POST` | `/plans/:id/pause`   | Pause active plan              |

### Posts (HITL)

| Method | Path                    | Description                                          |
| ------ | ----------------------- | ---------------------------------------------------- |
| `GET`  | `/posts/review`         | Get posts pending review                             |
| `GET`  | `/posts/review/buffer`  | Get next N posts per agent (approval buffer preview) |
| `PUT`  | `/posts/:id`            | Edit post content                                    |
| `POST` | `/posts/:id/approve`    | Approve single post                                  |
| `POST` | `/posts/approve-batch`  | Bulk approve array of post IDs                       |
| `POST` | `/posts/:id/veto`       | Veto / reject post with reason                       |
| `POST` | `/posts/:id/reschedule` | Change scheduled time                                |
| `GET`  | `/posts/:id/analytics`  | Get post engagement data                             |

### Guardrails

| Method   | Path                        | Description                                 |
| -------- | --------------------------- | ------------------------------------------- |
| `GET`    | `/guardrails`               | Get org-level guardrails + active blackouts |
| `PUT`    | `/guardrails`               | Update global prohibitions list             |
| `POST`   | `/guardrails/blackouts`     | Add a sensitive event blackout window       |
| `DELETE` | `/guardrails/blackouts/:id` | Remove a blackout window                    |

### Billing

| Method | Path                    | Description                                          |
| ------ | ----------------------- | ---------------------------------------------------- |
| `GET`  | `/billing/subscription` | Get current plan, status, usage this period          |
| `GET`  | `/billing/usage`        | Detailed usage breakdown (posts, accounts, brands)   |
| `POST` | `/billing/subscribe`    | Create Stripe subscription (returns checkout URL)    |
| `POST` | `/billing/upgrade`      | Upgrade to a higher tier mid-period                  |
| `POST` | `/billing/downgrade`    | Schedule downgrade at end of current period          |
| `POST` | `/billing/cancel`       | Cancel subscription at period end                    |
| `GET`  | `/billing/invoices`     | List past invoices with overage breakdown            |
| `PUT`  | `/billing/overage-cap`  | Update monthly overage spending cap                  |
| `POST` | `/billing/webhook`      | Stripe webhook receiver (internal — not user-facing) |

### New routes added (improvement cycle)

| Method | Path | Description |
|---|---|---|
| `GET` | `/agents/:id/logs` | Per-agent action log stream |
| `GET/POST/PATCH/DELETE` | `/campaigns` | Campaign CRUD |
| `GET` | `/campaigns/:id/analytics` | Campaign rollup analytics with per-platform breakdown |
| `POST` | `/repurpose/blog` | URL → platform-specific social posts |
| `GET/POST/PATCH/DELETE` | `/team` | Workflow participant management |
| `POST` | `/team/invite` | Issue signed 7-day invite token |
| `POST` | `/team/accept` | Accept invite, create user + participant row |
| `GET/POST/PATCH/DELETE` | `/webhooks` | Webhook endpoint CRUD with HMAC secrets |
| `GET` | `/reports/plan/:planId` | CSV plan performance export (Agency+) |
| `GET` | `/reports/brand/:brandId` | CSV brand performance export (Agency+) |
| `POST` | `/posts/:id/ab-test` | Generate A/B content variant pair |
| `POST` | `/posts/:id/ab-test/promote` | Promote A/B winner based on engagement |
| `GET` | `/posts/review` | HITL queue (filter: brandProfileId, platform, contentType) |
| `POST` | `/posts/batch-approve` | Bulk approve filtered selection |

---

## 14. Frontend Dashboard

### Pages

| Route | Description |
|---|---|
| `/dashboard` | Stats, upcoming posts, recent activity |
| `/dashboard/brands` | All brand profiles |
| `/dashboard/brands/[id]` | Brand details, ingested files, extracted identity |
| `/dashboard/brands/[id]/ingest` | Upload PDFs / enter URL |
| `/dashboard/agents` | All agents |
| `/dashboard/agents/[id]` | Edit persona, diet instructions, linked accounts + log viewer |
| `/dashboard/accounts` | Connected social accounts with OAuth status |
| `/dashboard/plans` | All marketing plans |
| `/dashboard/plans/[id]` | 30-day calendar view of scheduled posts |
| `/dashboard/campaigns` | Campaign list with goals and budget cap |
| `/dashboard/campaigns/[id]` | Campaign rollup analytics by platform |
| `/dashboard/review` | HITL queue with filter by brand/platform/content type + bulk actions + A/B test |
| `/dashboard/repurpose` | Blog URL → platform-specific social posts |
| `/dashboard/reports` | CSV export for plan and brand performance (Agency+) |
| `/dashboard/team` | Invite and manage workflow participants |
| `/dashboard/webhooks` | Webhook endpoint CRUD |
| `/dashboard/analytics` | Engagement charts by platform / agent |
| `/dashboard/billing` | Current plan, usage meters, upgrade CTA |
| `/dashboard/settings` | Org settings and guardrails |

### HITL Review Component

The review queue is the most critical UI component. It must support:

- **Approval Buffer** — shows the next 5 pending posts per agent in a preview strip; user can scan and "Approve Next 5" in one action without opening each post
- Side-by-side: AI-generated content vs. brand guidelines summary
- Inline text editing before approving
- One-click approve / veto with veto reason dropdown
- Reschedule datepicker
- Platform preview (renders post as it would appear on X / LinkedIn / Instagram)
- Bulk approve for trusted agents (with a confirmation modal warning)
- **Agent Silence Switch** — per-agent toggle to pause all future posts from that agent immediately; active jobs in BullMQ are drained and cancelled

### Agent Silence / Emergency Override

During a PR crisis or sensitive news event, users need a one-action way to stop an agent.

```typescript
// routes/agents.ts

// POST /agents/:id/silence
router.post("/:id/silence", auth, async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  // 1. Mark agent inactive in DB
  await db
    .update(agents)
    .set({ isActive: false, silencedAt: new Date(), silenceReason: reason })
    .where(and(eq(agents.id, id), eq(agents.organizationId, req.user.orgId)));

  // 2. Cancel all pending BullMQ jobs for this agent's posts
  const pendingPosts = await db.query.scheduledPosts.findMany({
    where: and(
      eq(scheduledPosts.agentId, id),
      inArray(scheduledPosts.status, ["approved", "scheduled"]),
    ),
  });

  for (const post of pendingPosts) {
    if (post.bullJobId) {
      const job = await postExecutionQueue.getJob(post.bullJobId);
      await job?.remove();
    }
    await db
      .update(scheduledPosts)
      .set({ status: "silenced" })
      .where(eq(scheduledPosts.id, post.id));
  }

  // 3. Log the silence event
  await logAgentAction(id, "agent_silenced", {
    reason,
    triggeredBy: req.user.id,
  });

  res.json({ silenced: true, cancelledPosts: pendingPosts.length });
});

// POST /agents/:id/resume
router.post("/:id/resume", auth, async (req, res) => {
  await db
    .update(agents)
    .set({ isActive: true, silencedAt: null, silenceReason: null })
    .where(and(eq(agents.id, id), eq(agents.organizationId, req.user.orgId)));
  res.json({ resumed: true });
});
```

**Schema additions needed:**

```typescript
// Add to agents table in schema.ts
silencedAt: timestamp('silenced_at'),
silenceReason: text('silence_reason'),

// Add 'silenced' to postStatusEnum
export const postStatusEnum = pgEnum('post_status', [
  'draft', 'pending_review', 'approved', 'scheduled',
  'published', 'failed', 'vetoed', 'silenced'  // ← new
]);
```

**Dashboard UI:** The agent card shows a red "Silence Agent" button prominently on the detail page. On the overview page, silenced agents display a `⏸ SILENCED` badge. The silence action requires typing the agent name to confirm (prevents accidental kills).

---

## 15. Environment Variables

```bash
# ── App ──────────────────────────────────────────
NODE_ENV=production
PORT=4000
API_URL=https://api.anthyx.ai
DASHBOARD_URL=https://app.anthyx.ai

# ── Database ──────────────────────────────────────
DATABASE_URL=postgresql://anthyx:password@localhost:5432/anthyx
REDIS_URL=redis://localhost:6379

# ── Qdrant ────────────────────────────────────────
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=your_qdrant_api_key

# ── AI / LLM ──────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# ── Social (Direct APIs) ──────────────────────────
TWITTER_CLIENT_ID=
TWITTER_CLIENT_SECRET=
TWITTER_CALLBACK_URL=https://api.anthyx.ai/v1/accounts/oauth/callback

INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=
INSTAGRAM_CALLBACK_URL=https://api.anthyx.ai/v1/accounts/oauth/callback

LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_CALLBACK_URL=https://api.anthyx.ai/v1/accounts/oauth/callback

# ── Image Generation ──────────────────────────────
DALLE_MODEL=dall-e-3

# ── Template-Based Asset Generation ──────────────
BANNERBEAR_API_KEY=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# ── IP Rotation / Proxy (Shadow Ban Protection) ───
BRIGHT_DATA_PROXY_1=http://user:pass@zproxy.lum-superproxy.io:22225
BRIGHT_DATA_PROXY_2=http://user:pass@zproxy.lum-superproxy.io:22226
BRIGHT_DATA_PROXY_3=http://user:pass@zproxy.lum-superproxy.io:22227

# ── Storage (assets) ──────────────────────────────
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
AWS_S3_BUCKET=anthyx-assets
# or DigitalOcean Spaces
DO_SPACES_KEY=
DO_SPACES_SECRET=
DO_SPACES_ENDPOINT=nyc3.digitaloceanspaces.com
DO_SPACES_BUCKET=anthyx-assets

# ── Security ──────────────────────────────────────
JWT_SECRET=minimum_32_char_random_string
TOKEN_ENCRYPTION_KEY=64_char_hex_string   # 32 bytes → openssl rand -hex 32
OAUTH_STATE_SECRET=

# ── Billing (Stripe) ──────────────────────────────
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
# Stripe Price IDs (create in Stripe dashboard, one per plan × interval)
STRIPE_PRICE_STARTER_MONTHLY=price_...
STRIPE_PRICE_STARTER_ANNUAL=price_...
STRIPE_PRICE_GROWTH_MONTHLY=price_...
STRIPE_PRICE_GROWTH_ANNUAL=price_...
STRIPE_PRICE_AGENCY_MONTHLY=price_...
STRIPE_PRICE_AGENCY_ANNUAL=price_...
STRIPE_PRICE_SCALE_MONTHLY=price_...
STRIPE_PRICE_SCALE_ANNUAL=price_...

# ── Monitoring ────────────────────────────────────
SENTRY_DSN=
```

---

## 16. Infrastructure & Deployment

### Docker Compose (Local Dev)

```yaml
# docker-compose.yml

version: "3.9"

services:
  api:
    build: ./api
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=development
    env_file: .env
    depends_on:
      - postgres
      - redis
      - qdrant
    volumes:
      - ./api/src:/app/src

  worker:
    build: ./api
    command: node dist/workers/index.js
    env_file: .env
    depends_on:
      - postgres
      - redis
      - qdrant

  dashboard:
    build: ./apps/dashboard
    ports:
      - "3000:3000"
    env_file: .env

  postgres:
    image: postgres:15-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: anthyx
      POSTGRES_USER: anthyx
      POSTGRES_PASSWORD: password
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data

  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - qdrantdata:/qdrant/storage

volumes:
  pgdata:
  redisdata:
  qdrantdata:
```

### Production Architecture

```
DigitalOcean / AWS
├── Load Balancer (Nginx)
│   ├── → API Server (2x droplet, Docker)
│   │   └── BullMQ Workers (same containers, separate process)
│   └── → Dashboard (Vercel or separate container)
├── Managed PostgreSQL (DO Managed DB or AWS RDS)
├── Managed Redis (DO Managed Redis or AWS ElastiCache)
└── Qdrant (dedicated droplet, 4GB RAM minimum)
```

### GitHub Actions CI/CD

```yaml
# .github/workflows/deploy.yml

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run tests
        run: npm test
      - name: Build Docker images
        run: docker-compose -f docker-compose.prod.yml build
      - name: Push to registry
        run: docker push ...
      - name: Deploy to droplet
        run: ssh deploy@${{ secrets.SERVER_IP }} 'cd anthyx && docker-compose pull && docker-compose up -d'
```

---

## 17. Development Workflow

### Local Setup

```bash
# 1. Clone and install
git clone https://github.com/org/anthyx.git
cd anthyx
npm install        # installs all packages (Turborepo)

# 2. Start infrastructure
docker-compose up postgres redis qdrant -d

# 3. Run migrations
cd api
npx drizzle-kit migrate

# 4. Seed Qdrant collections (creates empty collections)
npm run seed:qdrant

# 5. Start API + workers
npm run dev        # from api — starts Express + worker processes

# 6. Start dashboard
cd apps/dashboard
npm run dev        # Next.js on :3000
```

### Database Migrations

```bash
# Generate migration from schema change
npx drizzle-kit generate

# Apply migration
npx drizzle-kit migrate

# Inspect current schema
npx drizzle-kit studio
```

### Testing

```bash
# Unit tests
npm run test

# Integration tests (requires running Docker services)
npm run test:integration

# E2E (Playwright)
npm run test:e2e
```

---

## 18. Build Phases & Milestones

### Phase 1 — Foundation (Weeks 1–4)

- [ ] Monorepo setup (Turborepo, TypeScript, ESLint, Prettier)
- [ ] Docker Compose environment (Postgres, Redis, Qdrant)
- [ ] Database schema + Drizzle migrations (including `silencedAt`, `assetTrack`, `globalProhibitions`, `plan_tiers`, `subscriptions`, `usage_records`)
- [ ] Seed `plan_tiers` table with all 6 tiers and their limits/feature flags
- [ ] Auth system (JWT + user/org tables)
- [ ] Brand ingestion service (PDF + Markdown + URL)
- [ ] Qdrant collection setup + embedding pipeline
- [ ] Basic agent CRUD API + silence/resume endpoints
- [ ] X (Twitter) OAuth + posting integration
- [ ] LinkedIn OAuth + posting integration
- [ ] BullMQ queue setup + post execution worker with timing jitter
- [ ] Guardrails schema + injection into all agent prompts
- [ ] `PlanLimitsEnforcer` middleware — check limits before every create action
- [ ] Sandbox plan auto-assigned on org creation
- [ ] Basic Next.js dashboard (auth, brands, agents pages)

### Phase 2 — Core Agent Loop (Weeks 5–8)

- [ ] Three-agent architecture: Strategist, Copywriter, Reviewer
- [ ] MCP server with all 8 tools registered
- [ ] 30-day plan generation engine (Strategist Agent)
- [ ] Copywriter + Reviewer loop with retry-on-rewrite
- [ ] HITL review queue: approval buffer (next 5), inline edit, bulk approve, veto with reason
- [ ] Agent silence dashboard UI with confirmation modal
- [ ] Instagram Graph API integration
- [ ] Telegram Bot API integration
- [ ] BannerBear template rendering + Cloudinary dynamic cards (Track A assets)
- [ ] DALL-E 3 as fallback asset generation (Track B)
- [ ] CDN upload pipeline (S3 / DO Spaces)
- [ ] Post analytics ingestion worker
- [ ] Analytics dashboard (Recharts)
- [ ] Sensitive event blackout UI + API
- [ ] **Stripe integration: subscription creation, webhook handler, customer portal**
- [ ] **`/dashboard/billing` page: plan display, usage meters, upgrade CTA**
- [ ] **Usage tracker: increment `usage_records` on every post publish**
- [ ] **Usage warning emails at 80% of plan limits (via Resend or SendGrid)**
- [ ] **14-day Growth trial on sign-up (no credit card)**

### Phase 3 — Scale & Feedback Loop (Weeks 9–12)

- [ ] social-mcp unified integration
- [ ] IP rotation via Bright Data proxy pool (per-org deterministic routing)
- [ ] User-Agent rotation in post executor
- [ ] Engagement scoring algorithm (`computeVoicePerformance`, `classifyVoices`)
- [ ] Autonomous feedback loop: Strategist reads performance scores and adjusts plans
- [ ] Multi-organization support + RBAC
- [ ] Advanced rate limit management per platform (Redis budget tracking)
- [ ] BullMQ dashboard (Bull Board) for ops visibility
- [ ] Sentry error tracking integration
- [ ] Load testing (k6) — target: 5,000+ concurrent scheduled posts
- [ ] Production infrastructure on DigitalOcean
- [ ] **Overage calculation worker: runs at period end, creates Stripe invoice line items**
- [ ] **`/dashboard/billing/upgrade` plan comparison page with annual toggle**
- [ ] **Stripe Customer Portal integration (self-serve cancel, update card)**
- [ ] **Dunning flow: past_due → 3-day grace → account suspension (posts paused, not deleted)**
- [ ] **White-label dashboard toggle (Agency tier)**

---

## 19. Agent Build Instructions

> This section is addressed directly to AI coding agents executing on this codebase.

### Execution Rules

1. **Always scope database queries by `organizationId`** — never query without this filter.
2. **Always scope Qdrant queries by `brandProfileId`** — every vector search must include a `must` filter on `brandProfileId`. No exceptions.
3. **Never merge the three agents into a single prompt** — Strategist, Copywriter, and Reviewer must remain separate LLM calls. Merging defeats the adversarial compliance gate.
4. **The Reviewer has no memory of the Copywriter's reasoning** — it only receives the output. Never pass `reasoning` from the Copywriter to the Reviewer.
5. **Never call a social media API from within an agent** — agents (Brain layer) only call MCP tools. Platform I/O happens in workers (Hands layer) only.
6. **Never call an LLM from within a BullMQ worker directly** — workers call services, which call agents. Keep the layers clean.
7. **All OAuth token operations go through OAuthProxyService** — workers must never decrypt tokens directly or call platform refresh endpoints.
8. **Validate all LLM output with Zod before writing to database** — LLMs can hallucinate schema violations. Parse and validate every JSON response.
9. **BullMQ jobs are idempotent** — before executing a post job, check `post.status === 'approved'` and exit cleanly if already published, vetoed, or silenced.
10. **Rate limits are tracked per organization per platform** — check Redis budget before every publish attempt. On limit, re-queue with a calculated delay.
11. **Guardrails are always injected first** — `buildGuardrailBlock()` output must be the first block in every agent system prompt, before any persona or task instructions.
12. **Check for active blackouts at execution time** — the post worker must call `getActiveGuardrails()` at job runtime, not just at schedule time. Blackout windows can be added after a job is queued.
13. **All posting requests go through the proxy router** — never call a platform API without `buildProxiedAgent(organizationId)`. Raw direct calls are not permitted.
14. **Apply timing jitter to every scheduled job** — never schedule at machine-precision intervals. Always apply ±3 minute jitter in `schedulePostJob()`.
15. **Image generation always uses the asset track router** — never call DALL-E directly from a worker. Always go through `generateAssetForPost()` which routes template vs. AI.
16. **Image generation prompts always inject hex codes** — never call DALL-E 3 without including brand primary color in the prompt.
17. **Log all agent actions** — store tool inputs/outputs and Reviewer verdicts in an `agent_logs` table. Audit trail is non-negotiable.
18. **HITL is enforced at the worker layer, not just the API** — the post execution worker must re-check `post.status === 'approved'` before publishing.
19. **Feedback loop is opt-in per plan** — the Strategist reads analytics only if `plan.feedbackLoopEnabled === true` AND the brand has ≥20 published posts in the lookback window.
20. **Silence check before every worker execution** — before running any post job, verify `agent.isActive === true`. If silenced, update post status to `silenced` and exit.
21. **Enforce plan limits before every create/publish action** — call `PlanLimitsEnforcer.check()` before creating a new brand, agent, account, or publishing a post. Never rely on the frontend to enforce limits.
22. **Increment usage records on every publish** — the post worker must call `usageTracker.incrementPost(organizationId)` after every successful publish. Missed increments corrupt billing.

### Adding a New Platform

1. Add to `platformEnum` in `db/schema.ts` + run migration
2. Implement OAuth flow in `routes/accounts.ts`
3. Add platform posting function in `services/posting/`
4. Add platform rules string in `prompt-builder.ts` → `getPlatformRules()`
5. Add rate limit budget in the rate limiter config
6. Register platform in social-mcp integration (if supported)
7. Add platform preview component to HITL dashboard

### Adding a New MCP Tool

1. Create tool file in `mcp/tools/your-tool.ts`
2. Export `{ name, description, inputSchema, handler }`
3. Register with `server.tool(name, handler)` in `mcp/server.ts`
4. Add TypeScript types in `packages/types/`
5. Document input/output schema in this file under Section 7

---

## 20. Pricing & Monetisation

### Pricing Philosophy

Anthyx charges for **AI workers doing work**, not humans logging in. The core billing unit is a combination of active agents, connected accounts, and posts published — not per-seat headcount. This aligns cost with value delivered and avoids penalising teams for adding team members.

> **Competitive position:** Buffer charges ~$10/channel/month with no autonomous AI. Hootsuite starts at $199/month per user with manual workflows. Anthyx's $49 Starter delivers more autonomous value than $100+ of either tool.

---

### Plan Tiers

| Plan           | Price (Monthly) | Price (Annual) | Brands    | Agents    | Accounts  | Posts/mo  |
| -------------- | --------------- | -------------- | --------- | --------- | --------- | --------- |
| **Sandbox**    | Free            | Free           | 1         | 1         | 2         | 15        |
| **Starter**    | $49             | $39 (~20% off) | 1         | 3         | 5         | 120       |
| **Growth**     | $149            | $119           | 3         | 10        | 15        | 500       |
| **Agency**     | $399            | $319           | 15        | Unlimited | 50        | 2,500     |
| **Scale**      | $999            | $799           | Unlimited | Unlimited | 100       | 10,000    |
| **Enterprise** | Custom          | Custom         | Unlimited | Unlimited | Unlimited | Unlimited |

### Feature Flags Per Tier

| Feature                      | Sandbox          | Starter       | Growth | Agency | Scale |
| ---------------------------- | ---------------- | ------------- | ------ | ------ | ----- |
| Brand Ingestion              | ✅               | ✅            | ✅     | ✅     | ✅    |
| 3-Agent Pipeline             | ✅               | ✅            | ✅     | ✅     | ✅    |
| HITL Dashboard               | ✅ (required)    | ✅ (optional) | ✅     | ✅     | ✅    |
| Autonomous Scheduling        | ❌               | ✅            | ✅     | ✅     | ✅    |
| Guardrails & Blackouts       | ❌               | ✅            | ✅     | ✅     | ✅    |
| Template Assets (BannerBear) | ✅ (watermarked) | ✅            | ✅     | ✅     | ✅    |
| AI Assets (DALL-E 3)         | ❌               | ❌            | ✅     | ✅     | ✅    |
| Feedback Loop                | ❌               | ❌            | ✅     | ✅     | ✅    |
| Agent Silence / Kill Switch  | ❌               | ✅            | ✅     | ✅     | ✅    |
| White-label Dashboard        | ❌               | ❌            | ❌     | ✅     | ✅    |
| IP Rotation (proxy pool)     | ❌               | ❌            | ❌     | ❌     | ✅    |
| RBAC                         | ❌               | ❌            | ❌     | ✅     | ✅    |
| SLA + CSM                    | ❌               | ❌            | ❌     | ❌     | ✅    |

---

### Overage Pricing

When an organisation exceeds their plan's included limits within a billing period, overage is charged at the end of the month as a Stripe invoice line item.

| Resource                     | Overage Rate            |
| ---------------------------- | ----------------------- |
| Posts beyond plan limit      | $0.04 / post            |
| Social accounts beyond limit | $8.00 / account / month |
| Brand profiles beyond limit  | $25.00 / brand / month  |

Users can set a **hard overage cap** in Settings. At 80% of the cap, they receive a warning email. At 100%, further actions that would incur overage are blocked until the cap is raised or they upgrade.

---

### Free Tier Design (Sandbox)

The Sandbox is permanently free with no time limit. It is **genuinely functional** but self-limiting by scale.

**What works fully:**

- Complete brand ingestion pipeline (1 brand)
- Full 3-agent pipeline (Strategist, Copywriter, Reviewer)
- 15 posts generated and published per month
- HITL dashboard — every post requires manual approval before publish
- Basic analytics (last 30 days)

**What is restricted to drive upgrade:**

- No autonomous scheduling — posts must be manually triggered after HITL approval
- Asset watermark — BannerBear/Cloudinary cards include a small "Powered by [Product]" badge
- 2 social accounts maximum (X + one other)
- 1 brand profile only
- No guardrails, blackouts, or agent silence controls
- No IP rotation — posts originate from shared server IP
- No feedback loop / engagement scoring

**Conversion triggers:**

- Hitting 15 posts → upgrade modal with post count remaining
- Attempting to connect 3rd account → hard block with plan comparison
- Attempting to enable autonomous scheduling → feature gate with Starter CTA
- Asset watermark removal → prominent upgrade prompt in asset preview

---

### Trial Strategy

- **New sign-up:** Automatically enrolled in a **14-day Growth trial** (no credit card required)
- Trial includes full Growth feature set: autonomous scheduling, DALL-E 3 assets, feedback loop, 500 posts
- At trial end: auto-downgrades to Sandbox unless payment method added
- Trial-to-paid conversion prompt on Day 10 and Day 13
- Growth trial chosen specifically (not Starter) to let users experience full autonomous operation before they feel the limits

---

### Stripe Integration

```typescript
// services/billing/stripe.ts

import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-12-18.acacia",
});

// ── Create subscription ────────────────────────────────────────────

export async function createSubscription(params: {
  organizationId: string;
  email: string;
  priceId: string;
  trialDays?: number;
}): Promise<{ checkoutUrl: string }> {
  const customer = await stripe.customers.create({
    email: params.email,
    metadata: { organizationId: params.organizationId },
  });

  const session = await stripe.checkout.sessions.create({
    customer: customer.id,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: params.priceId, quantity: 1 }],
    subscription_data: params.trialDays
      ? { trial_period_days: params.trialDays }
      : undefined,
    success_url: `${process.env.DASHBOARD_URL}/billing?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.DASHBOARD_URL}/billing/upgrade?cancelled=true`,
    metadata: { organizationId: params.organizationId },
  });

  return { checkoutUrl: session.url! };
}

// ── Webhook handler ────────────────────────────────────────────────

export async function handleStripeWebhook(rawBody: Buffer, signature: string) {
  const event = stripe.webhooks.constructEvent(
    rawBody,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!,
  );

  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutComplete(
        event.data.object as Stripe.Checkout.Session,
      );
      break;
    case "customer.subscription.updated":
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionCancelled(
        event.data.object as Stripe.Subscription,
      );
      break;
    case "invoice.payment_failed":
      await handlePaymentFailed(event.data.object as Stripe.Invoice);
      break;
  }
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const orgId = session.metadata?.organizationId;
  if (!orgId) return;

  const subscription = await stripe.subscriptions.retrieve(
    session.subscription as string,
  );
  const priceId = subscription.items.data[0].price.id;
  const tier = PRICE_ID_TO_TIER[priceId];

  await db
    .update(subscriptions)
    .set({
      tier,
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      status: subscription.status,
      trialEndsAt: subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : null,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    })
    .where(eq(subscriptions.organizationId, orgId));
}

// Map Stripe price IDs to internal tier names
const PRICE_ID_TO_TIER: Record<string, PlanTier> = {
  [process.env.STRIPE_PRICE_STARTER_MONTHLY!]: "starter",
  [process.env.STRIPE_PRICE_STARTER_ANNUAL!]: "starter",
  [process.env.STRIPE_PRICE_GROWTH_MONTHLY!]: "growth",
  [process.env.STRIPE_PRICE_GROWTH_ANNUAL!]: "growth",
  [process.env.STRIPE_PRICE_AGENCY_MONTHLY!]: "agency",
  [process.env.STRIPE_PRICE_AGENCY_ANNUAL!]: "agency",
  [process.env.STRIPE_PRICE_SCALE_MONTHLY!]: "scale",
  [process.env.STRIPE_PRICE_SCALE_ANNUAL!]: "scale",
};
```

---

### Plan Limits Enforcement

Every action that consumes a plan resource must be checked **before** execution. This is enforced at the service layer, not just the frontend.

```typescript
// services/billing/limits.ts

export class PlanLimitsEnforcer {
  static async check(
    organizationId: string,
    action:
      | "create_brand"
      | "create_agent"
      | "connect_account"
      | "publish_post",
  ): Promise<void> {
    const [sub, usage, tier] = await Promise.all([
      getSubscription(organizationId),
      getCurrentUsage(organizationId),
      getPlanTier(organizationId),
    ]);

    // Check if subscription is active (not past_due or cancelled)
    if (sub.status === "cancelled") {
      throw new PlanLimitError(
        "subscription_cancelled",
        "Your subscription has been cancelled. Reactivate to continue.",
      );
    }

    if (sub.status === "past_due") {
      throw new PlanLimitError(
        "payment_failed",
        "Your payment has failed. Update your payment method to continue.",
      );
    }

    switch (action) {
      case "create_brand":
        if (tier.maxBrands !== -1 && usage.brandsActive >= tier.maxBrands) {
          throw new PlanLimitError(
            "brand_limit",
            `Your plan includes ${tier.maxBrands} brand${tier.maxBrands === 1 ? "" : "s"}. Upgrade to add more.`,
          );
        }
        break;

      case "create_agent":
        if (tier.maxAgents !== -1 && usage.agentsActive >= tier.maxAgents) {
          throw new PlanLimitError(
            "agent_limit",
            `Your plan includes ${tier.maxAgents} agents. Upgrade to add more.`,
          );
        }
        break;

      case "connect_account":
        if (usage.accountsConnected >= tier.maxSocialAccounts) {
          throw new PlanLimitError(
            "account_limit",
            `Your plan includes ${tier.maxSocialAccounts} social accounts. Upgrade to connect more.`,
          );
        }
        break;

      case "publish_post":
        if (usage.postsPublished >= tier.maxPostsPerMonth) {
          // Check overage cap before blocking
          const overageAllowed = await checkOverageCap(organizationId);
          if (!overageAllowed) {
            throw new PlanLimitError(
              "post_limit",
              "You have reached your monthly post limit and overage cap. Upgrade or raise your overage cap.",
            );
          }
          // Allow publish — will be billed as overage at period end
          await usageTracker.markAsOverage(organizationId);
        }
        break;
    }
  }
}
```

---

### Usage Tracking

```typescript
// services/billing/usage-tracker.ts

export const usageTracker = {
  async incrementPost(organizationId: string): Promise<void> {
    await db
      .update(usageRecords)
      .set({ postsPublished: sql`posts_published + 1`, updatedAt: new Date() })
      .where(
        and(
          eq(usageRecords.organizationId, organizationId),
          lte(usageRecords.billingPeriodStart, new Date()),
          gte(usageRecords.billingPeriodEnd, new Date()),
        ),
      );
  },

  async getUsagePercent(organizationId: string): Promise<{
    posts: number; // 0–100+
    accounts: number;
    brands: number;
  }> {
    const [usage, tier] = await Promise.all([
      getCurrentUsage(organizationId),
      getPlanTier(organizationId),
    ]);
    return {
      posts: Math.round((usage.postsPublished / tier.maxPostsPerMonth) * 100),
      accounts: Math.round(
        (usage.accountsConnected / tier.maxSocialAccounts) * 100,
      ),
      brands:
        tier.maxBrands === -1
          ? 0
          : Math.round((usage.brandsActive / tier.maxBrands) * 100),
    };
  },
};
```

---

### Overage Calculation (End of Period)

A BullMQ cron job runs at the end of each billing period to calculate overage and create a Stripe invoice line item.

```typescript
// workers/overage.worker.ts

// Runs via cron: '0 2 * * *' (2am daily — catches period ends)
async function processOverageForPeriodEnds() {
  const endingToday = await db.query.usageRecords.findMany({
    where: and(
      eq(usageRecords.overageInvoiced, false),
      lte(usageRecords.billingPeriodEnd, new Date()),
      gt(usageRecords.overageCostCents, 0),
    ),
  });

  for (const record of endingToday) {
    const sub = await getSubscription(record.organizationId);
    if (!sub.stripeCustomerId || !sub.stripeSubscriptionId) continue;

    // Create invoice item on their next invoice
    await stripe.invoiceItems.create({
      customer: sub.stripeCustomerId,
      subscription: sub.stripeSubscriptionId,
      amount: record.overageCostCents,
      currency: "usd",
      description: buildOverageDescription(record),
    });

    await db
      .update(usageRecords)
      .set({ overageInvoiced: true })
      .where(eq(usageRecords.id, record.id));
  }
}

function buildOverageDescription(record: UsageRecord): string {
  const lines = [];
  if (record.postsOverage > 0)
    lines.push(`${record.postsOverage} extra posts × $0.04`);
  if (record.accountsOverage > 0)
    lines.push(`${record.accountsOverage} extra accounts × $8.00`);
  if (record.brandsOverage > 0)
    lines.push(`${record.brandsOverage} extra brands × $25.00`);
  return `Usage overage: ${lines.join(", ")}`;
}
```

---

### Dunning Flow (Failed Payments)

When `invoice.payment_failed` fires from Stripe:

```
Day 0  — Payment fails → subscription status → 'past_due'
         → Email: "Payment failed, update card to avoid interruption"
         → Posts continue publishing (3-day grace period)

Day 3  — Second Stripe retry → if still failed:
         → Email: "Account suspended — posts paused (not deleted)"
         → BullMQ workers skip org's jobs (status check: sub.status === 'past_due')
         → Dashboard shows suspension banner with update card CTA

Day 7  — Third retry → if still failed:
         → Subscription cancelled
         → Org downgraded to Sandbox
         → All scheduled posts set to 'draft' (not deleted)
         → Email: "Subscription cancelled — your data is safe, reactivate anytime"
```

---

### Cost Analysis (Unit Economics)

Approximate LLM + infrastructure cost per post at each tier:

| Action                                   | Approx Cost                   |
| ---------------------------------------- | ----------------------------- |
| Strategist Agent (per plan, ~30 posts)   | $0.08–0.15 (Opus, multi-tool) |
| Copywriter per post (Sonnet)             | $0.01–0.02                    |
| Reviewer per post (Haiku)                | $0.001–0.003                  |
| BannerBear template card                 | ~$0.001                       |
| DALL-E 3 image                           | ~$0.04                        |
| BullMQ job + infra per post              | ~$0.002                       |
| **Total cost per post (template asset)** | **~$0.015–0.025**             |
| **Total cost per post (AI asset)**       | **~$0.055–0.065**             |

**Gross margin by tier (template assets only):**

| Plan    | Revenue/mo | Est. LLM+Infra Cost      | Gross Margin |
| ------- | ---------- | ------------------------ | ------------ |
| Starter | $49        | ~$3–4 (120 posts)        | ~92%         |
| Growth  | $149       | ~$10–14 (500 posts)      | ~91%         |
| Agency  | $399       | ~$45–60 (2,500 posts)    | ~85%         |
| Scale   | $999       | ~$175–225 (10,000 posts) | ~78%         |

Scale tier margin compresses due to DALL-E 3 volume — mitigate by defaulting heavy Scale users to BannerBear templates and reserving DALL-E for posts with `assetTrack = 'ai'` explicitly set.

---

_Anthyx — Technical Reference v1.0 — Confidential_
