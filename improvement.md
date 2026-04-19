# Anthyx — Improvement & Feature Backlog

## New Features

### Agent / AI

**A/B content testing**
Generate 2 variants per post, publish each to a slice of audience, and auto-promote the winner based on engagement rate. The `postAnalytics` schema already tracks all required signals — this is a natural extension of the feedback loop.

**Comment/DM auto-reply agent**
A fourth agent that monitors platform inboxes and replies in brand voice, subject to `dietInstructions` and guardrails. Sits downstream of the current Strategist → Copywriter → Reviewer chain.

**Competitor analysis MCP tool**
New MCP tool that fetches and summarises competitor post patterns, fed into the strategist alongside `web-search-trends`. Gives the strategist differentiation signal, not just industry trends.

**Multi-language content generation**
Add `targetLocale` to `StrategistRunInput` and the copywriter system prompt. Qdrant is already filtered per brand — locale-segmented ingestion is feasible without schema changes.

**Brand voice drift detection**
After each review cycle, compute semantic distance between the generated post and the brand's Qdrant vectors. Surface an alert when drift exceeds a configurable threshold. Protects brand consistency at scale.

---

### Platform Expansion via social-mcp

Anthyx currently posts to X, Instagram, LinkedIn, Facebook, Telegram, and TikTok. The `social-mcp` package (v1.7.0) adds the following platforms and richer tool sets — all available via `npm i social-mcp`:

| Platform | Available Tools | Priority |
|---|---|---|
| **Discord** | Send message, get messages | High — community-first brands |
| **WhatsApp** | Send message | High — high-reach for emerging markets |
| **Slack** | Send message, get messages, list channels | Medium — B2B / internal comms |
| **Reddit** | Submit post, get posts, comment, vote, search, get user info | Medium — niche community marketing |
| **Threads** | Get profile, create post, reply, get posts, delete post | High — Instagram-adjacent, fast growing |
| **Bluesky** | Get profile, create post, reply, get posts, delete post, like post, search posts | Medium — tech/creator audience |
| **Mastodon** | Get profile, create post, reply, search posts, boost post, favourite post, delete post | Low — niche but brand-safe |
| **YouTube** | Get channel info, search videos, get video info, list channel videos, get comments, post comment, update video | High — video repurposing and comment engagement |

**What needs to change:**
- Add new values to the `platformEnum` in [apps/api/src/db/schema.ts](apps/api/src/db/schema.ts) for each new platform.
- Extend `social-mcp.ts` in the posting service to route to social-mcp tool calls for each new platform.
- Extend the strategist's platform distribution logic to include the new platforms when active accounts exist.
- Upgrade the existing X, Instagram, and LinkedIn integrations to use richer social-mcp tools (reply to tweet, like post, add comment) to support the comment/DM auto-reply agent feature.

**Existing platform upgrades available from social-mcp:**

| Platform | New Tools Unlocked |
|---|---|
| X / Twitter | Reply to tweet, like tweet, delete tweet, search tweets |
| Instagram | Get posts (enables analytics sync) |
| LinkedIn | Get profile, like post, add comment, search people |
| Facebook | Get posts (enables analytics sync) |
| Telegram | Forward message, pin message, get channel admins, edit/delete message |
| TikTok | Query creator info, get user info, get post status, photo post |

---

### Content Formats

**Thread and carousel support**
Twitter threads and Instagram carousels are high-performing formats. `contentType` and `mediaUrls[]` are already modelled in `scheduledPosts` — add a `segments` JSONB column for multi-part content and extend the copywriter prompt to output segmented arrays.

**Blog / RSS repurposing pipeline**
Accept a URL, extract the article, and reformat it as platform-specific social posts. The existing brand-ingestion pipeline (parser → extractor → embedder) is directly reusable for this flow.

---

### Product / Dashboard

**Campaign grouping**
Link multiple marketing plans under a campaign with shared goals, a budget cap, and a rollup analytics view. Requires one FK column (`campaignId`) on `marketingPlans` — minimal schema change with high product value for agency-tier customers.

**White-label client reports**
PDF/CSV export of plan performance per brand, scoped to agency-tier customers. The `whiteLabel` flag is already modelled on `planTiers` — no billing logic changes needed, just a report-generation service.

**Webhook / notification integrations**
Push post-publish events to Slack, Discord, or email. BullMQ already emits a job on every post completion — add a lightweight notification worker that reads user-configured webhook URLs.

---

## Improvements to Existing Features

### Agent Pipeline

**Parallelize content generation in the orchestrator**
`generateContentForPlan` iterates draft posts in a sequential `for...of` loop (`orchestrator.ts:130–188`). At scale a 30-day plan blocks on each post in series. Replace with `Promise.allSettled` + a concurrency limiter (e.g. `p-limit` at 5) to saturate the LLM quota without overwhelming it.

**Replace strategist JSON retry loop with structured output**
The strategist retries raw text extraction up to 4 times (`strategist.ts:145–160`). Gemini supports `responseMimeType: "application/json"` with a `responseSchema` — use native structured output to eliminate the retry loop entirely and make parse failures impossible.

**Deepen the feedback loop**
`feedbackLoopEnabled` currently only passes analytics into the strategist prompt (`strategist.ts:117`). The same performance data should also adjust copywriter tone weighting and tighten reviewer thresholds — creating a closed learning loop rather than just informing planning.

---

### Analytics & Scoring

**Fix voice trait / content type mislabelling in scorer**
`computeVoicePerformance` groups by `contentType` but the result type is named `VoicePerformanceScore.voiceTrait` (`scorer.ts:24`). Either rename the field to `contentType` throughout, or separately capture actual voice traits from the copywriter output so the scoring reflects real brand-voice signal.

**Real-time overage alerting**
`overageCostCents` accumulates in `usageRecords` but there is no in-app warning when approaching tier limits. Add threshold checks in `usage-tracker.ts` that enqueue a BullMQ notification job at 80 % and 100 % of the monthly post quota.

---

### Scalability

**Incremental brand re-ingestion**
`ingestStatus` supports `idle / processing / done / failed` but has no incremental update path. When brand guidelines change, the entire Qdrant collection must be rebuilt from scratch. Add a diff-based re-ingest that only re-embeds changed chunks and tombstones removed ones.

**Expose agent logs in the dashboard**
`agentLogs` is written on every reviewer pass, rewrite, and failure but is never surfaced to users. Add a `GET /agents/:id/logs` route and a log viewer page in the dashboard so teams can debug reviewer rejections and audit agent behaviour without touching the database directly.

**Add filter and bulk-action to the HITL review queue**
The review queue currently shows all `pending_review` posts flat. Agency-tier customers managing multiple brands and platforms need filter by brand, platform, and content type, plus bulk approve/veto on a filtered selection. Without this, the queue becomes unmanageable at volume.
