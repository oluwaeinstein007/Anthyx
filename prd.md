# Product Requirements Document

**Product:** Anthyx (working title)
**Version:** 1.1
**Status:** Active Development
**Last Updated:** 2026-04-27
**Author:** Olanrewaju Sanni

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Product Vision](#3-product-vision)
4. [Target Users](#4-target-users)
5. [Goals & Success Metrics](#5-goals--success-metrics)
6. [System Architecture Overview](#6-system-architecture-overview)
7. [Core Feature Areas](#7-core-feature-areas)
   - 7.1 [Brand Management & Ingestion](#71-brand-management--ingestion)
   - 7.2 [AI Agent Pipeline](#72-ai-agent-pipeline)
   - 7.3 [Marketing Plan Generation](#73-marketing-plan-generation)
   - 7.4 [Content Review & Approval (HITL)](#74-content-review--approval-hitl)
   - 7.5 [Multi-Platform Publishing](#75-multi-platform-publishing)
   - 7.6 [Analytics & Feedback Loop](#76-analytics--feedback-loop)
   - 7.7 [A/B Testing](#77-ab-testing)
   - 7.8 [Compliance & Guardrails](#78-compliance--guardrails)
   - 7.9 [Team Collaboration & RBAC](#79-team-collaboration--rbac)
   - 7.10 [Campaigns](#710-campaigns)
   - 7.11 [Content Repurposing](#711-content-repurposing)
   - 7.12 [Email Marketing & Mailing Lists](#712-email-marketing--mailing-lists)
   - 7.13 [RSS Feed Integration](#713-rss-feed-integration)
   - 7.14 [Unified Inbox](#714-unified-inbox)
   - 7.15 [Webhooks & Integrations](#715-webhooks--integrations)
   - 7.16 [Reporting & Exports](#716-reporting--exports)
   - 7.17 [Competitive Intelligence](#717-competitive-intelligence)
8. [Admin Panel](#8-admin-panel)
9. [Affiliate Program](#9-affiliate-program)
10. [Billing & Pricing](#10-billing--pricing)
11. [Non-Functional Requirements](#11-non-functional-requirements)
12. [Technical Stack](#12-technical-stack)
13. [Planned Enhancements (Roadmap)](#13-planned-enhancements-roadmap)

---

## 1. Executive Summary

Anthyx is a multi-agent, autonomous marketing SaaS designed to help businesses and agencies manage their social media presence at scale without proportional human effort. The platform ingests a brand's identity — voice, tone, values, colors, and competitive context — and uses a three-stage AI agent pipeline (Strategist → Copywriter → Reviewer) to autonomously generate, schedule, and publish high-quality content across up to 16 social platforms.

Unlike generic social media schedulers or single-model AI writing tools, Anthyx is built around the concept of a persistent brand persona: the AI learns and adapts from published content performance, enforces brand safety guardrails on every output, and routes everything through a configurable human-in-the-loop (HITL) approval workflow before publication. The result is a system that can run an entire content operation — from monthly planning through live publishing — with minimal manual intervention while remaining auditable and controllable at every stage.

---

## 2. Problem Statement

### 2.1 The content scaling problem

Growing brands face a compounding challenge: the number of platforms they must be present on grows every year, and each platform has its own format conventions, audience expectations, and optimal posting cadence. Maintaining a consistent, high-quality, brand-voice-aligned presence across X, Instagram, LinkedIn, TikTok, Facebook, Reddit, Bluesky, and a half-dozen other channels simultaneously is beyond the bandwidth of most marketing teams.

Existing solutions address only part of this:

| Tool Category | What It Does Well | What It Fails At |
|---|---|---|
| Social schedulers (Buffer, Hootsuite) | Batch scheduling UI | No content generation; still requires human writing |
| Generic AI writing tools (ChatGPT, Jasper) | One-shot text drafts | No brand memory; no scheduling; no platform-aware formatting |
| Social listening tools (Sprout, Brandwatch) | Analytics + monitoring | No content generation or publishing |
| Full-service agencies | End-to-end management | High cost; slow turnaround; hard to scale |

### 2.2 The brand voice consistency problem

When content production is distributed across humans (or generic AI), brand voice inevitably drifts. Tone descriptors like "confident but approachable" or "technical yet accessible" are subjective and hard to enforce consistently across dozens of posts per week. There is no persistent memory of what was approved, what was vetoed, or what performed well.

### 2.3 The compliance and brand safety gap

Brands operate in environments with legal, PR, and reputational constraints that change frequently — regulatory events, competitive news, crisis periods. Static prompt templates and scheduling tools have no awareness of these contexts and cannot guarantee that scheduled content is still appropriate at posting time.

---

## 3. Product Vision

**Short-form:** Give every brand its own autonomous content operation — one that learns, adapts, and never posts something the brand wouldn't stand behind.

**Expanded:** Anthyx is the infrastructure layer for brand-aware AI content. Every brand stored in the system is a living entity: it has memory (Qdrant vector embeddings), rules (guardrails), personas (agents), and a publishing history that continuously feeds back into future content decisions. The AI pipeline is not a black box — every generation step is logged, every approval decision is auditable, and every metric feeds back into the next planning cycle.

---

## 4. Target Users

### 4.1 Primary Personas

**Growth-stage Brand Marketers**
- Role: Marketing manager or CMO at a startup or SMB
- Situation: Running social media with a lean team (1–3 people), posting to 3–6 platforms
- Pain: Burning hours writing platform-specific variants of the same message; inconsistent voice across team members
- Goal: Consistent brand voice at 10× the output, without hiring more writers
- Plan fit: Starter → Growth

**Digital Marketing Agencies**
- Role: Agency founder or operations lead managing 5–20 client brands
- Situation: Running social media execution for multiple clients simultaneously, each with distinct voice and platform strategies
- Pain: Client approval bottlenecks; context-switching between brand guidelines; reporting overhead
- Goal: A white-label platform to manage all client brands under one roof with per-client isolation
- Plan fit: Agency → Scale

**Solo Consultants and Freelancers**
- Role: Independent social media consultant managing 2–5 brands
- Situation: Using multiple disconnected tools; doing manual content variation for each platform
- Pain: Too much admin; not enough time for strategic work
- Goal: Automate the production layer so they can focus on strategy and client relationships
- Plan fit: Growth

**Enterprise Marketing Operations**
- Role: VP of Marketing or content ops lead at a large brand
- Situation: Centralized content team managing regional brand variants, product lines, or campaigns
- Pain: Governance gaps; no audit trail; slow approval cycles; no systematic A/B testing
- Goal: Structured content operations with full audit trails, RBAC, and programmatic control
- Plan fit: Enterprise

### 4.2 Secondary Stakeholders

- **Super Admins** — Anthyx internal team using the admin panel to manage the platform
- **Affiliate Partners** — Marketers and consultants earning referral commissions by bringing in new customers

---

## 5. Goals & Success Metrics

### 5.1 Product Goals

| Goal | Description |
|---|---|
| Reduce time-to-published-content | From brand brief → published post in under 5 minutes of human time |
| Maintain brand voice at scale | Voice drift score < 35% cosine distance across published posts |
| Increase content volume per team | 10× content output per marketing team member vs. manual workflows |
| Automate platform formatting | Zero manual formatting for platform-specific constraints (character limits, hashtags, markup) |
| Close the feedback loop | AI content quality improves measurably over 30 days based on engagement data |

### 5.2 Key Performance Indicators

**Activation**
- Time from registration to first published post
- % of organizations completing brand ingestion within 7 days of signup

**Engagement**
- Monthly active organizations (at least one post generated)
- Posts published per organization per month
- HITL approval rate (% approved without edit vs. % requiring manual revision)

**Retention**
- 30-day, 60-day, and 90-day org retention
- Subscription renewal rate by tier
- Churn by plan tier (target: churn rate decreasing as tier increases)

**Revenue**
- Monthly recurring revenue (MRR) and annual recurring revenue (ARR)
- Upgrade rate (sandbox → starter, starter → growth, etc.)
- Overage revenue as % of total MRR
- Affiliate-attributed revenue and conversion rate

**Quality**
- Avg reviewer pass rate on first attempt (target: > 80%)
- Avg veto rate per organization (lower = better calibrated brand profiles)
- Avg engagement rate on AI-generated posts vs. industry benchmarks

---

## 6. System Architecture Overview

Anthyx is a Turborepo monorepo with four deployable applications and two shared packages.

### 6.1 Application Topology

| Service | Technology | Port | Purpose |
|---|---|---|---|
| `api` | Express 4 + Drizzle ORM | 8080 | REST API; all business logic; BullMQ workers |
| `frontend` | Next.js 14 | 3000 | User-facing product dashboard |
| `admin` | Next.js 14 | 3001 | Internal super-admin panel |
| `affiliate` | Next.js 14 | 3002 | Affiliate partner portal |
| `services/mcp` | fastmcp SSE | — | MCP server wrapping all social platform APIs |
| `services/agent` | BullMQ worker | — | AI agent pipeline workers (plan, content, analytics) |
| `services/ingestor` | BullMQ worker | — | Brand document ingestion pipeline |

### 6.2 Infrastructure Dependencies

| Dependency | Role |
|---|---|
| PostgreSQL | Primary relational store (all persistent data) |
| Redis (IORedis) | BullMQ queues; OAuth state; email verify tokens; JWT allowlist |
| Qdrant | Vector store for brand embeddings (per-brand collection, tenant-isolated) |
| Stripe | Subscription billing + overage invoicing (global) |
| Paystack | Subscription billing (Africa/emerging markets) |
| Resend | Transactional email delivery |
| Cloudinary | Media CDN for AI-generated and uploaded assets |
| BannerBear | Asset template rendering for branded images |
| Sentry | Error monitoring and alerting |

### 6.3 Async Job Architecture

All long-running operations are processed asynchronously via BullMQ. No synchronous work exceeds ~100 ms from a user request.

| Queue | Producer | Consumer | Purpose |
|---|---|---|---|
| `anthyx-plan-generation` | `POST /plans/generate` | plan.worker | Strategist agent → 30 ScheduledPost rows |
| `anthyx-content-generation` | plan.worker | content.worker | Copywriter + Reviewer per post |
| `anthyx-post-execution` | `POST /posts/:id/approve` | post.worker | OAuth publish → social platform |
| `anthyx-ingestor` | `POST /brands/:id/ingest` | ingestor.worker | PDF/URL/Markdown → Qdrant embeddings |
| `anthyx-analytics` | post.worker (30-min delay) | analytics.worker | Fetch engagement metrics post-publish |
| `anthyx-notification` | usage-tracker | notification.worker | Webhooks + email alerts |

### 6.4 Multi-Tenancy Model

All data is scoped to an `organizationId`. The Qdrant vector store uses per-brand collections named `brand_{brandProfileId}` and every query is filtered by `brandProfileId`, ensuring complete tenant isolation at the semantic search layer. PostgreSQL row-level data is scoped by `organizationId` throughout.

### 6.5 Auth Token Architecture

Anthyx issues JWTs with distinct `aud` claims to prevent cross-service token abuse:

- `aud: "user"` — issued on regular user login; accepted by all `auth` middleware; rejected by `adminAuth`
- `aud: "admin"` — issued on admin login and admin invite acceptance; accepted only by `adminAuth` middleware; rejected by all user-facing routes

Tokens are stored in HTTP-only cookies (`auth_token` for users, `admin_token` for admins). Cookie names differ, ensuring no accidental cross-submission.

---

## 7. Core Feature Areas

### 7.1 Brand Management & Ingestion

A **Brand Profile** is the central configuration object in Anthyx. It stores everything the AI needs to generate on-brand content: voice, tone, colors, typography, content pillars, audience notes, competitors, and product information.

#### Brand Profile Fields

| Category | Fields |
|---|---|
| **Identity** | Name, industry, logo URL, tagline, primary/secondary colors, typography (font stack), brand emojis, website URL, brand email |
| **Brand Stage** | `idea` / `startup` / `growth` / `established` / `enterprise` |
| **Brand Story & Values** | Mission statement, vision statement, core values (label + description pairs), origin story |
| **Voice & Tone** | Voice traits (structured JSON), tone descriptors (string array), voice examples (positive training samples), content pillars |
| **Content Strategy** | Content dos, content don'ts, banned words, CTA preferences per platform, hashtag strategy (always/rotate/avoid), posting languages, content mix ratios (educational/promotional/entertaining/conversational) |
| **Audience & Market** | Audience personas (structured: name, age range, job title, pain points, goals, platforms), audience notes (free text), geographic focus, target market |
| **Social & Contact** | Social handles per platform (Twitter, Instagram, LinkedIn, TikTok, YouTube, Threads), website URL, brand email |
| **Knowledge** | Embedded documents (Qdrant), ingest history (source name, type, date, summary), brand context (statements, competitors, products, value proposition) |

#### Brand Health Score

Every brand profile displays a computed health score (0–100) based on the completeness of 14 key fields: industry, tagline, mission statement, vision statement, core values, voice traits, tone descriptors, voice examples, primary colors, content pillars, content guidelines, website URL, logo URL, and audience information. Missing fields are listed with guidance prompts to help users improve the score.

#### Brand Lifecycle

| Action | Behavior |
|---|---|
| **Archive** | Soft-archive via `archivedAt` timestamp; hidden from workspace by default; fully reversible |
| **Unarchive** | Clears `archivedAt`; brand reappears in workspace |
| **Duplicate** | Clones all profile fields (new name `"... (copy)"`); excludes ingest state and vector data; respects brand plan limits |
| **Tone Preview** | AI (Gemini Flash) generates a sample 2–4 sentence social post demonstrating current voice config; regenerable on demand |

#### Brand List Features

- Search by name or industry
- Filter by industry (auto-populated dropdown from existing brands)
- Show/hide archived brands toggle
- Per-card quick stats: total posts generated, pending review count, website link
- Per-card actions: view profile, duplicate, archive/unarchive (with inline confirm)
- Brand avatar: shows logo if available, else colored initials from primary brand color

#### Brand Ingestion Pipeline

Users can upload brand knowledge in three formats: multiple PDF files, plain text, or a URL. The ingestion pipeline:

1. Accepts up to 10 files simultaneously; queues one `anthyx-ingestor` job per file
2. Parses the source into plain text (PDF via pdfparse; HTML via URL fetch; markdown passthrough)
3. Emits real-time progress updates via `job.updateProgress()`: **Parsing → Extracting → Embedding → Done**
4. Calls Gemini 1.5 Flash for structured extraction: industry, voice traits, tone descriptors, colors, typography, brand statements, audience notes, content pillars, and competitor names
5. Generates 768-dimensional vector embeddings via Gemini `text-embedding-004`
6. Upserts embeddings into the brand's Qdrant collection with diff detection (incremental re-ingestion supported)
7. Updates the brand profile record in PostgreSQL with extracted attributes
8. Appends an entry to `ingest_history` (JSONB array on brand profile): source type, source name, ingest timestamp, and summary

The frontend ingestion page polls `GET /brands/:id/ingest-job/:jobId` every 2 seconds and renders a step-progress bar per job (Parse / Extract / Embed / Done). On completion, the ingestion history log is displayed with a collapsible history panel showing all previous ingestions.

#### Limits

- Max brands per organization: enforced per plan tier (1 on Sandbox/Starter, 3 on Growth, 15 on Agency, unlimited on Scale/Enterprise)
- Max files per ingest request: 10
- Max file size: 50 MB per file

---

### 7.2 AI Agent Pipeline

An **Agent** is a named AI persona bound to a brand. Each agent has:

- `name` — persona name used in prompt construction
- `description` — role description
- `dietInstructions` — additional content rules specific to this agent (additive to brand guardrails)
- `systemPromptOverride` — optional full override of the default system prompt
- `isActive` — can be silenced (deactivates persona, cancels all pending posts from this agent)
- `silencedAt` / `silenceReason` — audit trail for silencing events

#### Three-Stage Content Generation Pipeline

Every piece of content passes through three AI stages in sequence:

**Stage 1 — Strategist (Gemini 1.5 Pro, agentic)**

The Strategist runs as a long-horizon agentic loop with access to MCP tools. Given a brand profile, target platforms, goals, date range, and posts-per-day target, it generates a full 30-day content calendar: a list of `PlanItem` objects specifying date, platform, content type, topic, hook, CTA, visual suggestion, and notes.

The Strategist also detects brand voice drift: it runs a semantic similarity check (cosine distance) against the brand's Qdrant embeddings before generating each plan. If drift exceeds 35%, a `brand_voice_drift_alert` is logged and the prompt is reinforced with stronger voice anchors.

**Stage 2 — Copywriter (Claude Sonnet 4.6, structured output)**

For each `PlanItem`, the Copywriter generates the final post content. Input includes:

- Persona name and diet instructions
- Brand voice rules retrieved from Qdrant (semantic search, filtered by `brandProfileId`)
- Veto learning context: recent vetoed post patterns and reasons fed back as negative examples
- Platform-specific constraints (character limits, hashtag counts, markup rules)
- Topic, hook, CTA from the Strategist output
- Target locale for multilingual support (es-MX, fr-FR, pt-BR, etc.)
- Engagement insights (if feedback loop mode is enabled)

Output is structured JSON: `{ content, hashtags[], suggestedMediaPrompt, reasoning }`. Thread and carousel posts use a `segments[]` array for multi-part content.

**Stage 3 — Reviewer (Claude Haiku 4.5, adversarial)**

The Reviewer checks every draft against:

- Organization-level global prohibitions (word/phrase blocklist)
- Active sensitive event blackout windows (e.g., election day, crisis period)
- Agent diet instructions
- General brand safety principles

Output: `{ verdict: "pass" | "fail" | "rewrite", issues[], revisedContent, revisedHashtags }`

If the verdict is `rewrite`, the Reviewer provides a revised version and the cycle retries (max 2 retries). After 2 failed rewrites, the post status is set to `failed` and escalated to human review. A `pass` verdict advances the post to `pending_review` status.

All three stages log every action to the `agent_logs` table with the full payload for auditability.

#### Veto Learning

When a user vetoes a post with a reason, the veto learner records the pattern (content type, tone, structure, reasoning) as a negative training signal. On subsequent Copywriter calls for the same brand, up to 5 recent veto patterns are injected as explicit negative examples in the system prompt. A **Quality Improvement** dashboard widget on the brand profile shows the trend: approval rate over time, most common veto reasons, and an improvement score computed over a configurable 30–180 day window.

#### Agent Actions

| Action | Endpoint | Behavior |
|---|---|---|
| Create | `POST /agents` | Enforces `maxAgents` plan limit |
| Update | `PUT /agents/:id` | Updates diet instructions, system prompt |
| Silence | `POST /agents/:id/silence` | Sets `isActive = false`, cancels pending posts |
| View logs | `GET /agents/:id/logs` | Paginated audit stream |

---

### 7.3 Marketing Plan Generation

A **Marketing Plan** is a 30-day content calendar bound to a brand, agent, and optional campaign. Plans contain a collection of `ScheduledPost` records.

#### Plan Generation Request

| Field | Type | Description |
|---|---|---|
| `brandProfileId` | UUID | Target brand |
| `agentId` | UUID | Agent persona to use |
| `platforms` | Platform[] | Target platforms (up to 16) |
| `goals` | string[] | Campaign goals (e.g., "brand awareness", "product launch") |
| `startDate` | ISO date | Plan start date |
| `durationDays` | 7–90 | Plan duration in days |
| `postsPerPlatformPerDay` | number | Posting cadence |
| `targetLocale` | string | Content language/locale |
| `feedbackLoopEnabled` | boolean | Whether to use past analytics for generation |
| `campaignId` | UUID (optional) | Link to a campaign |

Generation is async (`202 Accepted`). The Strategist worker creates `ScheduledPost` rows with `status: draft`, then queues content generation for each post in the `anthyx-content-generation` queue.

#### Plan Status Lifecycle

```
generating → pending_review → active → completed
                           ↘ paused
                           ↘ failed
```

#### Scheduled Post Status Lifecycle

```
draft → pending_review → approved → scheduled → published
                      ↘ vetoed  ──→ approved  (reversible)
                      ↘ failed
                      ↘ silenced  (agent silenced after post was scheduled)
```

Status transitions (e.g., `vetoed → approved`) are supported with a confirmation dialog and a mandatory reason field. All transitions are recorded in `post_status_logs` with `actorId`, `fromStatus`, `toStatus`, `reason`, and timestamp.

#### Self-Created Posts

Users can manually create posts alongside AI-generated ones. The manual post editor enforces per-platform constraints (character limits, hashtag count), allows scheduling with the same dispatch mechanism as AI-generated posts, and routes through the same HITL queue (unless auto-approved).

#### Shadow-Ban Protection

All post dispatch times are jittered by ±3 minutes relative to the scheduled time. This prevents detectable posting patterns across high-volume accounts.

---

### 7.4 Content Review & Approval (HITL)

The Human-in-the-Loop (HITL) review queue is the primary interface between the AI pipeline and human judgment. On the Sandbox plan, HITL review is mandatory for every post. On paid plans, HITL is optional — organizations can configure autonomous publishing.

#### Review Queue Capabilities

| Action | Description |
|---|---|
| View pending posts | Paginated list filtered by brand, platform, content type |
| Inline editing | Edit `contentText`, `contentHashtags`, and `scheduledAt` directly in the review UI |
| Approve | Moves post to `approved`; dispatches BullMQ job with ±3 min jitter |
| Veto | Moves post to `vetoed`; requires a reason; creates `post_status_logs` entry |
| Un-veto | Moves post from `vetoed` back to `approved`; confirmation dialog + reason required |
| Bulk approve | Up to 50 posts in a single request; enforces plan limits |
| Buffer view | Next 5 pending posts per agent, pre-loaded for batching |
| Regenerate | Requeues copywriter + reviewer for a fresh generation attempt |
| Regenerate image | Requeues DALL-E 3 image generation with the original `suggestedMediaPrompt` |

#### Approval Roles

Team members assigned to the `hitl` workflow stage have access to the review queue. The `canEdit` permission controls whether they can modify content before approving. The `canVeto` permission controls whether they can reject content.

All approval and veto actions are logged to `post_status_logs` with `actorId`, `fromStatus`, `toStatus`, `reason`, and timestamp.

---

### 7.5 Multi-Platform Publishing

#### Supported Platforms

| Platform | OAuth Type | Notes |
|---|---|---|
| X (Twitter) | OAuth 2.0 PKCE | 280-char limit, max 2 hashtags |
| Instagram | Facebook OAuth | Caption up to 2200 chars; hashtags as first comment |
| LinkedIn | OAuth 2.0 | 3000-char posts; max 3 inline hashtags |
| Facebook | Facebook OAuth | Full markdown stripped |
| TikTok | OAuth 2.0 | Video posts; caption up to 2200 chars |
| Telegram | Bot API token | Full markdown preserved |
| Discord | Bot API token | Full markdown; channel targeting |
| WhatsApp | Cloud API | Business account required |
| Reddit | OAuth 2.0 | Subreddit targeting |
| Threads | Instagram OAuth | 500-char limit |
| Bluesky | AT Protocol | 300-char limit |
| Mastodon | OAuth 2.0 | Instance-specific |
| YouTube | Google OAuth | Video descriptions |
| Pinterest | OAuth 2.0 | Pin descriptions |
| Email | SMTP / API | HTML email via Resend |

#### OAuth Flow

1. `GET /accounts/oauth/:platform` — generates authorization URL (state stored in Redis, 10-min TTL)
2. User authorizes in browser
3. `GET /accounts/oauth/:platform/callback` — exchanges code for tokens, encrypts with AES-256-GCM, stores in `social_accounts`
4. Auto-refresh: tokens are refreshed before expiry on every publish attempt

#### Platform-Aware Formatting

Before publishing, the `formatter` service normalizes content for each platform:

- Enforces character limits (truncate with ellipsis preservation)
- Moves hashtags to the appropriate position (e.g., first comment on Instagram)
- Strips or preserves markdown based on platform capabilities
- Splits thread/carousel posts into platform-native multi-part formats
- Handles locale-specific punctuation and encoding

#### Asset Generation

Posts can include AI-generated images. When the Copywriter provides a `suggestedMediaPrompt`, the asset generation worker calls DALL-E 3, uploads the result to Cloudinary, and attaches the CDN URL to the post. BannerBear templates are used for brand-consistent graphic overlays (logo, colors, typography).

---

### 7.6 Analytics & Feedback Loop

#### Engagement Metrics

After a post is published, the analytics worker fetches engagement data from the platform API after a 30-minute delay (to allow time for initial engagement). Metrics collected per post:

- Likes
- Reposts / Shares
- Comments
- Impressions
- Clicks
- Engagement rate (computed: interactions ÷ impressions)

Raw platform API response is stored in `post_analytics.rawData` (JSONB) alongside normalized fields.

#### Analytics Endpoints

| Endpoint | Returns |
|---|---|
| `GET /analytics` | Org-level overview: avg engagement rate by platform |
| `GET /analytics/posts` | Published posts ranked by engagement rate |
| `GET /analytics/posts/:id` | Single post detail with all metrics |
| `GET /analytics/voice-performance` | Tone/contentType distribution + engagement clustering |
| `GET /plans/:id/analytics` | Rollup across all posts in a plan |
| `GET /campaigns/:id/analytics` | Rollup across all plans in a campaign |

#### Feedback Loop Mode

When `feedbackLoopEnabled: true` on a plan, the analytics service clusters the past 30 days of published posts by `contentType` and computes average engagement rates per cluster. The Copywriter receives this as `engagementInsights`:

- **Promote:** content types in the top engagement quartile → Copywriter generates more of this type
- **Cut:** content types in the bottom quartile → Copywriter deprioritizes; Reviewer strictness increases for these types

This creates a self-improving loop: over time, the AI generates more of what works for each specific brand's audience.

---

### 7.7 A/B Testing

A/B tests are created at the post level. The system generates two content variants for the same topic:

- **Variant A:** Standard generation from the Copywriter pipeline
- **Variant B:** Explicitly different angle (different hook, structure, or tone weight)

Both variants pass through the full Reviewer stage. The A/B test record (`ab_tests` table) tracks both post IDs and monitors engagement over a 72-hour window after publication.

After 72 hours, the system auto-promotes the winner (higher `engagementRate`) by:

1. Setting `winnerId` on the A/B test record
2. Setting `status: winner_promoted`
3. Optionally feeding the winning variant's attributes back into the Copywriter context for future generations

#### A/B Test Endpoints

| Endpoint | Description |
|---|---|
| `GET /posts/ab-tests` | List all A/B tests with status and engagement comparison |
| `GET /posts/:id` | Single post detail (includes A/B test association if applicable) |

---

### 7.8 Compliance & Guardrails

Guardrails are a layered compliance system enforced at every stage of content generation.

#### Organization-Level Prohibitions

- `globalProhibitions: string[]` — a list of words, phrases, or patterns that must never appear in generated content
- Applied as a negative prompt prepended to every Copywriter and Reviewer system prompt
- Example: `["competitor brand names", "pricing claims we can't substantiate", "political commentary"]`

#### Sensitive Event Blackout Windows

`sensitiveEventBlackouts` is a JSONB array of time windows during which no content should be published (and no generation should occur). Structure:

```json
{
  "label": "General Election",
  "startDate": "2026-11-03",
  "endDate": "2026-11-04",
  "platforms": ["x", "instagram"],
  "reason": "Avoid political association"
}
```

Blackouts are checked at generation time and again at dispatch time (a post approved before a blackout window should not publish during it).

#### Brand Voice Drift Detection

The Strategist computes cosine similarity between newly generated content embeddings and the centroid of the brand's approved post embeddings in Qdrant. If drift exceeds 35%, a `brand_voice_drift_alert` event is logged and the generation is reinforced with stronger brand context before retrying.

#### Guardrail API

| Endpoint | Description |
|---|---|
| `GET /guardrails` | Retrieve org prohibitions + active blackout windows |
| `PUT /guardrails` | Update global prohibitions |
| `POST /guardrails/blackouts` | Add a blackout window |
| `DELETE /guardrails/blackouts/:id` | Remove a blackout window |

---

### 7.9 Team Collaboration & RBAC

Organizations can invite team members with scoped access to specific workflow stages and specific brands.

#### Workflow Stages

| Stage | Access |
|---|---|
| `plan_review` | View and comment on marketing plans before activation |
| `hitl` | Access the content review queue; approve or veto posts |
| `legal_review` | View-only access to pending posts for legal sign-off |
| `analytics_only` | View-only access to analytics dashboards |

#### Permissions

| Permission | Description |
|---|---|
| `canEdit` | Can modify post content inline in the review queue |
| `canVeto` | Can move posts to `vetoed` state |
| `notifyOn` | Array of events to receive email/webhook notifications for |

#### Scoping

Each `workflowParticipant` record can be scoped to:
- The entire organization (no `brandProfileId` filter)
- A specific brand (`brandProfileId` set)
- A specific agent (`agentId` set)

#### Team API

| Endpoint | Description |
|---|---|
| `POST /team/invite` | Issue signed invite link with pre-assigned stage and permissions |
| `GET /team` | List all workflow participants |
| `PATCH /team/:id` | Update participant stage or permissions |
| `DELETE /team/:id` | Remove participant |

---

### 7.10 Campaigns

**Campaigns** are grouping containers for multiple marketing plans, useful for organizing content around product launches, seasonal promotions, or ongoing content series.

| Field | Description |
|---|---|
| `name` | Campaign display name |
| `goals[]` | Strategic objectives |
| `budgetCapCents` | Optional budget ceiling for tracking |
| `status` | draft, active, completed |
| `startDate` / `endDate` | Campaign date range |

Plans can be linked to campaigns at creation time. Campaign analytics aggregate engagement across all linked plans, providing a unified view of a campaign's performance.

---

### 7.11 Content Repurposing

The repurpose feature takes a long-form blog article URL and transforms it into platform-specific social posts without requiring a full plan generation cycle.

**Flow:**
1. User provides a blog article URL
2. The repurpose service fetches the article, extracts title and body
3. For each target platform, the Copywriter reformats the article as a platform-native post (respecting character limits, hashtag rules, and tone)
4. Posts are returned as drafts ready for review or direct approval

**Endpoint:** `POST /repurpose/blog`

---

### 7.12 Email Marketing & Mailing Lists

Anthyx includes a lightweight email campaign module and subscriber list management for broadcast emails alongside social content.

#### Mailing Lists

| Feature | Description |
|---|---|
| Create lists | Named lists with optional description and tags |
| Add subscribers | Single-add or bulk CSV import (email, first name, last name, tags) |
| Subscriber status | `active` / `unsubscribed` per subscriber |
| Segmentation | Filter by tags; merge lists; export to CSV |
| Archive | Soft-archive lists without deleting subscriber history |

#### Email Campaign Fields

| Field | Description |
|---|---|
| `subject` | Email subject line |
| `previewText` | Preview text shown in inbox before opening |
| `htmlBody` | Full HTML email body |
| `plainText` | Plain text fallback |
| `recipientList[]` | Subscriber emails or mailing list ID |
| `status` | draft → scheduled → sent |
| `scheduledAt` | Scheduled send time |

#### Email Campaign API

| Endpoint | Description |
|---|---|
| `GET /email-campaigns` | List campaigns |
| `POST /email-campaigns` | Create draft |
| `PATCH /email-campaigns/:id` | Update campaign |
| `POST /email-campaigns/:id/send` | Schedule send via Resend |
| `GET /mailing-lists` | List subscriber lists |
| `POST /mailing-lists` | Create list |
| `POST /mailing-lists/:id/subscribers` | Add single subscriber |
| `POST /mailing-lists/:id/import` | Bulk CSV import |

---

### 7.13 RSS Feed Integration

Organizations can subscribe to RSS feeds per brand. The system polls feeds and surfaces new items as potential content inspiration or triggers for reactive posting.

| Endpoint | Description |
|---|---|
| `GET /brands/:brandId/feeds` | List active RSS feeds for a brand |
| `POST /brands/:brandId/feeds` | Subscribe to a new feed (URL + label) |
| `DELETE /brands/:brandId/feeds/:feedId` | Unsubscribe |

Feed items are stored in the `feed_items` table and can be flagged for review or used as source material for content repurposing.

---

### 7.14 Unified Inbox

The unified inbox aggregates mentions, DMs, and comments from connected social accounts into a single interface. Supported sources: X (Twitter), Instagram, Facebook, LinkedIn, Discord, Slack, Threads, Mastodon.

#### Inbox Actions

| Action | Description |
|---|---|
| View messages | All unread messages across all connected accounts |
| Reply | AI-generates a reply in the brand's voice; user can edit before sending |

The reply endpoint (`POST /inbox/:messageId/reply`) calls the Copywriter with the original message as context and the brand's voice profile, then sends the reply via the appropriate platform API.

---

### 7.15 Webhooks & Integrations

Organizations can configure webhook endpoints to receive real-time event notifications from Anthyx.

#### Supported Events

| Event | Trigger |
|---|---|
| `post_published` | A post is successfully published to a platform |
| `post_failed` | A post fails to publish after retries |
| `plan_ready` | A marketing plan generation completes |
| `usage_threshold` | Organization reaches 80% or 100% of plan limits |

#### Webhook Configuration

| Field | Description |
|---|---|
| `url` | HTTPS endpoint URL |
| `events[]` | List of events to subscribe to |
| `channels[]` | Optional: limit to specific platform channels |
| `secret` | HMAC-SHA256 signing secret (auto-generated) |
| `isActive` | Enable/disable without deleting |

All webhook payloads are signed with `X-Anthyx-Signature` (HMAC-SHA256 of the raw body using the endpoint secret). Integrations with Slack and Discord are natively supported as webhook destinations.

---

### 7.16 Reporting & Exports

Available on Agency tier and above (`whiteLabel` feature flag).

| Report | Format | Endpoint |
|---|---|---|
| Plan performance | CSV | `GET /reports/plan/:planId` |
| Brand performance | CSV | `GET /reports/brand/:brandId` |

Reports include per-post metrics (content, platform, published date, likes, reposts, comments, impressions, engagement rate) formatted for external stakeholder sharing.

---

### 7.17 Competitive Intelligence

A dedicated Competitive Intelligence workspace per brand provides AI-generated market analysis and competitor tracking.

#### Competitor Management

| Feature | Description |
|---|---|
| Track competitors | Add by name, URL, or social handle; classify as Direct / Indirect / Aspirational |
| Platform detection | Auto-detect active social platforms per competitor |
| Status tracking | Active / inactive / new classification |

#### AI Analysis

The `competitor-analyst` service generates structured competitive intelligence reports stored in `competitor_analyses`. Each analysis covers:

| Section | Content |
|---|---|
| **Industry Overview** | Market size, growth rate, key trends, major players |
| **Content Analysis** | Posting cadence, theme breakdown, format mix (video/image/text/carousel), best-performing types |
| **Engagement Benchmarks** | Average metrics per competitor; follower growth trends |
| **Gap Analysis** | Topics competitors don't cover; posting time gaps; hashtag and keyword opportunities |
| **Share of Voice** | Industry conversation ownership breakdown by platform and date range |
| **Sentiment Analysis** | Overall sentiment score per competitor; topic-level drill-down |

Analyses are on-demand (triggered by user action) and cached per brand. Users can view historical analyses and compare snapshots over time.

#### Competitive Intelligence API

| Endpoint | Description |
|---|---|
| `GET /competitive/:brandId/competitors` | List tracked competitors |
| `POST /competitive/:brandId/competitors` | Add competitor |
| `PUT /competitive/:brandId/competitors/:id` | Update competitor |
| `DELETE /competitive/:brandId/competitors/:id` | Remove competitor |
| `POST /competitive/:brandId/analyze` | Trigger AI analysis |
| `GET /competitive/:brandId/analyses` | List historical analyses |

---

## 8. Admin Panel

The Admin Panel is a separate Next.js application (port 3001) accessible only to users with `isSuperAdmin: true`. It provides internal visibility and control over the entire platform.

### 8.1 Sections

| Section | Capabilities |
|---|---|
| **Overview** | Platform-wide stats: total orgs, users, posts published |
| **Organizations** | Search, view detail, override tier or status, view members |
| **Users** | Search all users, view subscription, generate impersonation token |
| **Subscriptions** | Tier matrix with revenue stats per tier |
| **Billing** | Transaction history (Stripe + Paystack); billing metrics |
| **Plans** | All marketing plans; regenerate or view logs |
| **Agents** | All agents across all orgs; silence/resume; view logs |
| **Affiliates** | Approve/suspend affiliate applications; view payout records |
| **Promo Codes** | Create and disable discount codes (percent or fixed amount) |
| **Feature Flags** | Toggle features globally or per-org without code deploys |
| **Queues** | BullMQ job counts per queue (live monitoring) |
| **Audit Log** | Stream of `activity_events` across the platform |
| **Email Templates** | Edit transactional email templates (subject, HTML body, plain text) with live preview |
| **Plans (Pricing)** | Update plan tier pricing (applies to new subscribers only); change log |
| **Support** | Internal runbook and common issue resolution guides |
| **Team Invites** | Invite new admin-panel users via one-time secure links; assign roles; revoke pending invites |

### 8.2 Admin RBAC & Invite Flow

Super admins can invite new internal users to the admin panel without sharing credentials. The invite system:

1. Super admin creates invite via `POST /admin/invites` with target email and role
2. System generates a cryptographically secure token (48 chars, base64url), valid for 7 days
3. Super admin copies the invite link and sends it to the invitee (out of band)
4. Invitee visits `/accept-invite?token=...` on the admin app
5. Invitee sets their name and password — account created in the `anthyx-internal` org with `isSuperAdmin: true`
6. Token marked as `acceptedAt`; user redirected to the admin dashboard

#### Admin Roles

| Role | Access Level |
|---|---|
| **Owner** | Full platform access; can invite and manage other admins |
| **Admin** | Manage orgs, users, billing, subscriptions, and feature flags |
| **Support** | Read-only access to all platform data |
| **Billing** | Billing, subscription, and invoice access only |

All roles are enforced by `adminAuth` middleware (requires `aud: "admin"` JWT) at the route layer.

### 8.3 Feature Flags

Feature flags in Anthyx are runtime toggles that enable or disable specific functionality without a code deploy. They can be applied globally (`enabledGlobally`), per-org allowlist (`enabledForOrgs[]`), or per-org blocklist (`disabledForOrgs[]`).

Use cases:
- Beta feature rollout to selected organizations
- Emergency kill switch for a broken feature
- A/B testing new UX flows at the infrastructure level
- Granting early access to enterprise features during evaluation

### 8.4 Seeded Admin Accounts

Three internal accounts are seeded automatically via migration `0017_seed_admin_accounts.sql` into the `anthyx-internal` organization:

| Email | Role | `isSuperAdmin` |
|---|---|---|
| `superadmin@anthyx.com` | owner | true |
| `lanre@anthyx.com` | admin | true |
| `support@anthyx.com` | member | false |

All seeded accounts have `mustChangePassword: true` and require a password change on first login.

---

## 9. Affiliate Program

Anthyx operates a first-party affiliate program enabling partners to earn commissions for referring new paying customers.

### 9.1 Affiliate Lifecycle

```
Self-registration (pending) → Admin approval → Active affiliate → Invited to portal
```

### 9.2 Core Entities

**Affiliate** — represents the partner account:
- Linked to a user record
- `commissionRate` (default: configurable per affiliate)
- `totalEarnedCents` / `totalPaidCents` (running totals)
- `stripeAccountId` — for Stripe Connect payout disbursement
- Status: `pending` → `approved` → `suspended`

**Affiliate Link** — a unique tracking code per affiliate:
- `code` — URL-safe unique identifier (appended to the signup URL)
- `campaign` — optional campaign label for link attribution
- `clicks` / `conversions` — lifetime counters

**Affiliate Conversion** — one record per referred organization that purchases a plan:
- `commissionCents` — computed from the plan tier's price × commission rate
- Status: `pending` → `cleared` (after refund window) → `paid`

### 9.3 Affiliate Self-Registration

Affiliates apply via a public registration form on the affiliate portal (`/apply`). The form collects name, email, website, and promotional method. On submission:

1. Account created with `status: pending`
2. Welcome email sent via Resend
3. Admin notified of new pending application
4. Admin approves or rejects via the admin panel
5. Affiliate receives approval email with portal access link

### 9.4 Affiliate Portal

The Affiliate Portal is a separate Next.js application (port 3002) providing:

| Page | Content |
|---|---|
| Dashboard | Earnings summary, conversion count, link performance |
| Links | Create and manage tracking links; copy referral URLs |
| Conversions | List of converted organizations with commission amounts |
| Earnings | Pending, cleared, and total balance |
| Payouts | Payout history; request payout (above threshold) |
| Resources | Marketing copy, banner assets, brand guidelines |
| Settings | Affiliate account details; Stripe account ID |

### 9.5 Payout Flow

Payouts are processed via Stripe Connect. Affiliates must connect a Stripe account before requesting disbursement. A minimum balance threshold applies before payout is available (default: $50, configurable per affiliate).

---

## 10. Billing & Pricing

### 10.1 Plan Tiers

| Tier | Monthly | Annual | Brands | Agents | Social Accounts | Posts/Month |
|---|---|---|---|---|---|---|
| **Sandbox** | $0 | $0 | 1 | 1 | 2 | 15 |
| **Starter** | $49 | $39/mo | 1 | 3 | 5 | 120 |
| **Growth** | $149 | $119/mo | 3 | 10 | 15 | 500 |
| **Agency** | $399 | $319/mo | 15 | Unlimited | 50 | 2,500 |
| **Scale** | $999 | $799/mo | Unlimited | Unlimited | 100 | 10,000 |
| **Enterprise** | Custom | Custom | Unlimited | Unlimited | Unlimited | Unlimited |

Plan pricing is editable by super admins via the admin panel (`PUT /admin/plans/:tier`). Price changes apply to new subscribers only; existing subscriptions are not retroactively affected.

### 10.2 Feature Gating by Tier

| Feature | Sandbox | Starter | Growth | Agency | Scale | Enterprise |
|---|---|---|---|---|---|---|
| Autonomous scheduling | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| HITL required | Yes | Optional | Optional | Optional | Optional | Optional |
| Feedback loop | — | — | ✓ | ✓ | ✓ | ✓ |
| AI asset generation | — | — | ✓ | ✓ | ✓ | ✓ |
| Guardrails | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Agent silencing | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| RBAC team seats | — | — | — | ✓ | ✓ | ✓ |
| White-label reports | — | — | — | ✓ | ✓ | ✓ |
| IP rotation | — | — | — | — | ✓ | ✓ |
| Overage cap | $50 | $50 | $50 | $100 | $200 | None |

### 10.3 Overage Pricing

When an organization exceeds its plan limits, overage charges apply:

| Resource | Unit Price |
|---|---|
| Additional post | $0.04 |
| Additional social account | $8.00 |
| Additional brand | $25.00 |

Overage is invoiced at the end of the billing period up to the `overageCapCents` limit.

### 10.4 Billing Providers

- **Stripe** — primary billing provider for global users (subscription checkout sessions, webhook-driven status updates)
- **Paystack** — secondary billing provider for African and emerging markets (transaction initialization, email token verification)

Both providers update the same `subscriptions` table. Billing webhooks are idempotent.

### 10.5 Promo Codes

Promotional discounts can be created by super admins:

| Field | Description |
|---|---|
| `code` | Unique, case-insensitive code |
| `discountType` | `percent` or `fixed_cents` |
| `discountValue` | Percentage (0–100) or fixed amount in cents |
| `applicableTiers[]` | Which tiers this code can be applied to |
| `maxUses` | Total redemptions allowed |
| `expiresAt` | Optional expiry date |

Promo codes are validated client-side (`POST /billing/validate-promo`) before checkout to show the discounted price preview.

---

## 11. Non-Functional Requirements

### 11.1 Performance

| Metric | Target |
|---|---|
| API response time (p95) | < 200 ms for synchronous endpoints |
| Plan generation time | < 5 minutes end-to-end (async) |
| Content generation per post | < 90 seconds (async) |
| Post publish latency | < 15 seconds from job dequeue |
| Analytics fetch latency | < 30 seconds (after 30-min post-publish delay) |

### 11.2 Reliability

| Metric | Target |
|---|---|
| API availability | 99.9% uptime |
| BullMQ job failure retry | Automatic with exponential backoff (max 3 retries) |
| Failed post escalation | Moves to `failed` status; logged; human review surfaced |
| OAuth token refresh | Proactive refresh before expiry; graceful failure handling |

### 11.3 Security

| Requirement | Implementation |
|---|---|
| Authentication | JWT with `aud` claims (`user` vs `admin`); HTTP-only cookies; `SameSite: Lax` |
| Token scope enforcement | `adminAuth` middleware rejects `aud: "user"` tokens; `auth` middleware rejects `aud: "admin"` tokens |
| OAuth tokens | AES-256-GCM encryption at rest; per-org key derivation |
| Admin invite tokens | 48-char cryptographically random, base64url; 7-day expiry; single-use |
| Webhook payloads | HMAC-SHA256 signature on all outbound webhook payloads |
| SQL injection | Drizzle ORM with parameterized queries; no raw SQL string interpolation |
| XSS | Next.js default CSP; no `dangerouslySetInnerHTML` in user-facing apps |
| Multi-tenant isolation | All DB queries scoped to `organizationId`; Qdrant queries filtered by `brandProfileId` |
| Email verification | Required before accessing dashboard; Redis token (24h TTL) |

### 11.4 Scalability

- BullMQ workers are horizontally scalable; each queue consumer can run as multiple instances
- Qdrant collections are per-brand (horizontal partition by tenant)
- PostgreSQL connection pooling via Drizzle
- Redis cluster-compatible (IORedis)
- Stateless API servers (JWT-based; no server-side session state)

### 11.5 Observability

- **Error monitoring:** Sentry (all applications and workers)
- **Queue monitoring:** BullMQ dashboard available via admin panel (`GET /admin/queues`)
- **Audit trail:** `activity_events` table captures all agent and human actions with actor, entity, event type, and diff
- **Agent logs:** `agent_logs` table captures every AI action with full JSON payload
- **Ingestion progress:** Real-time step updates via BullMQ job progress events; polled by the frontend every 2 seconds

---

## 12. Technical Stack

| Layer | Technology | Version |
|---|---|---|
| **Runtime** | Node.js | ≥ 20.0.0 |
| **API Framework** | Express | 4.x |
| **ORM** | Drizzle ORM | Latest |
| **Database** | PostgreSQL | 15+ |
| **Queue** | BullMQ + IORedis | Latest |
| **Frontend** | Next.js | 14 (App Router) |
| **Data fetching** | TanStack React Query | v5 |
| **Styling** | Tailwind CSS | v3 |
| **Charts** | Recharts | Latest |
| **Monorepo** | Turborepo + pnpm workspaces | pnpm 10.28.1 |
| **Shared types** | TypeScript + Zod | Strict mode |
| **LLM — Strategist** | Gemini 1.5 Pro | google-generativeai SDK |
| **LLM — Copywriter** | Claude Sonnet 4.6 | Anthropic SDK |
| **LLM — Reviewer** | Claude Haiku 4.5 | Anthropic SDK |
| **LLM — Extraction** | Gemini 1.5 Flash | google-generativeai SDK |
| **LLM — Tone Preview** | Gemini 1.5 Flash | google-generativeai SDK |
| **Embeddings** | Gemini text-embedding-004 | 768 dimensions |
| **Vector Store** | Qdrant | Cloud-hosted |
| **Image Generation** | DALL-E 3 | OpenAI SDK |
| **Asset Templates** | BannerBear | REST API |
| **Media CDN** | Cloudinary | SDK |
| **MCP Protocol** | fastmcp | SSE transport |
| **Email** | Resend | SDK |
| **Billing (global)** | Stripe | SDK v4 |
| **Billing (Africa)** | Paystack | REST API |
| **Error monitoring** | Sentry | SDK |

---

## 13. Planned Enhancements (Roadmap)

The following features have been scoped and are planned for future development cycles. They are documented here to communicate product direction and inform architectural decisions made today.

### 13.1 Brand Management

- **Version history** — track changes to voice, tone, and brand positioning over time with rollback capability
- **Brand activity feed** — timeline of recent events: posts generated, documents ingested, tone updates, campaigns started
- **Export brand profile** — PDF or JSON snapshot for sharing with team or agency
- **Tone test** — paste existing content, get a score for how closely it matches the configured tone
- **Ingestion diff view** — after each ingest, show what attributes were added, updated, or left unchanged
- **Manual override after ingestion** — review and accept/edit/reject AI-extracted values before committing

### 13.2 Content & Review

- **Image lightbox and full-screen post view** — click image for full-screen overlay with zoom/pan; full-screen post detail mode
- **Bulk veto** — veto multiple posts at once with a shared reason
- **Post scheduling calendar** — calendar view of all scheduled and published posts across brands

### 13.3 Competitive Intelligence Enhancements

- **Automated monitoring** — polling-based competitor detection (new campaigns, posting cadence spikes)
- **Real-time alerts** — notifications for competitor activity thresholds; weekly digest email
- **Benchmarking dashboard** — single-view scorecard comparing the brand against all tracked competitors; exportable as branded PDF

### 13.4 Analytics Enhancements

- **Cross-brand performance comparison** — side-by-side engagement metrics for multi-brand workspaces
- **Predictive best-time analysis** — ML model trained on org-specific engagement data to recommend posting times per platform

### 13.5 Admin Panel Enhancements

- **Email template version rollback** — restore previous versions of edited transactional email templates
- **Audit log filtering** — filter activity events by actor, event type, date range, and entity
- **Org suspension flow** — suspend an org with reason; auto-cancels active posts and agents

---

*This document reflects the product as of 2026-04-27. It is a living document and should be updated as features ship or scope changes.*
