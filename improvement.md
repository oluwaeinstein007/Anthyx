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

---

### Team Members & Role-Based Access (RBAC)

**The problem with a flat role system:**
The `users.role` column is org-level and flat. Adding brand-scoped access, seat billing, handoff notifications, and audit trails as separate features produces four disconnected tables that all encode "who can do what" in different ways — guaranteed sync bugs and every new feature touches all of them.

**Better design: the workflow participant model**

The agent pipeline already has natural human intervention points:

```
Plan generation → Content generation → Reviewer agent → HITL → Publisher
```

A team member is simply a human assigned to intervene at one or more of those stages, on one or more brands. One table replaces separate brand-membership, role, and handoff-assignment tables:

```
workflow_participants
─────────────────────────────────────────────────────────
id               uuid PK
organizationId   uuid FK → organizations
userId           uuid FK → users
brandProfileId   uuid FK → brandProfiles  (nullable = org-wide)
agentId          uuid FK → agents         (nullable = all agents on brand)
stage            enum: plan_review | hitl | legal_review | analytics_only
canEdit          boolean
canVeto          boolean
notifyOn         text[]   -- e.g. ['high_risk', 'reviewer_fail', 'plan_ready']
createdAt        timestamp
```

**Unified event log** — replaces `agentLogs` and fills the missing human audit trail:

```
activity_events
─────────────────────────────────────────────────────────
id               uuid PK
organizationId   uuid FK → organizations
actorType        enum: agent | human
actorId          uuid  -- agentId or userId depending on actorType
entityType       enum: post | plan | brand | agent
entityId         uuid
event            text  -- 'caption_edited' | 'reviewer_fail' | 'post_approved' | 'plan_vetoed'
diff             jsonb -- { field, oldValue, newValue } for edits
createdAt        timestamp
```

**What this unified model gives you for free:**

- **RBAC** — middleware checks `workflow_participants` for the user's stage and brand. No separate role table needed.
- **Brand scoping** — nullable `brandProfileId` means org-wide or per-brand in one column, not a separate join table.
- **Agent-to-human handoff** — when the reviewer agent flags a high-risk post, query `workflow_participants` for users with `stage: legal_review` on that brand and `'high_risk'` in `notifyOn`. One notification worker handles all cases.
- **Full audit trail** — agent actions and human edits both write to `activity_events`. "Reviewer agent failed on Post #455" and "User B edited the caption on Post #455" are in the same queryable log.
- **Seat billing** — `SELECT COUNT(DISTINCT userId) FROM workflow_participants WHERE organizationId = ?`, enforced against `planTiers.maxTeamMembers` at invite time.

**Seat limits by tier:**

| Tier | Max Team Members |
|---|---|
| Sandbox / Starter | 1 (owner only) |
| Growth | 3 |
| Agency | 10 |
| Scale / Enterprise | Unlimited |

Add `maxTeamMembers integer` to `planTiers` and add `teamMembersActive integer` to `usageRecords`.

**Agency client portal — one row:**
```
{ userId: clientId, brandProfileId: clientBrandId, stage: 'hitl',
  canEdit: false, canVeto: true, notifyOn: ['plan_ready'] }
```
Client gets an email when the 30-day plan is ready, logs in, sees only their brand, can approve or veto posts, nothing else.

**Legal / compliance reviewer — one row:**
```
{ userId: legalId, brandProfileId: null, stage: 'legal_review',
  canEdit: false, canVeto: true, notifyOn: ['high_risk', 'reviewer_fail'] }
```
Gets notified only on flagged posts across all brands. Cannot touch plans, agents, or billing.

**Implementation order:**
1. Add `workflow_participants` and `activity_events` tables to schema + migrations
2. Migrate existing `agentLogs` writes to `activity_events`
3. Add `maxTeamMembers` to `planTiers` and `teamMembersActive` to `usageRecords`
4. Auth middleware: replace org-membership check with participant + stage check per route
5. `POST /auth/invite` — signed invite token, seat limit check, creates participant row on accept
6. `GET/PATCH/DELETE /team` — list, reassign stage, revoke
7. Notification worker subscribed to `activity_events` filtered by `notifyOn`
8. Dashboard: `/settings/team` page for invite management, stage assignment, and per-brand scoping

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

---

### Platform-Specific Text Formatting

**Current problem:** The copywriter receives platform rules via `prompt-builder.ts` (character limits, hashtag placement, tone) but the publisher in `social-mcp.ts` does crude string concatenation — it trusts whatever the LLM returned and just slaps hashtags on the end. The two sides don't enforce the same rules, so the LLM output and the final published text can diverge.

Specific failures today:

| Platform | Current behaviour | What should happen |
|---|---|---|
| **X** | `content + hashtags joined with spaces, sliced to 280` — silent truncation mid-sentence | Hard-enforce 280 chars, trim hashtags first not content, warn if content alone exceeds limit |
| **Instagram** | Hashtags appended to caption inline | Hashtags must go in a **first comment**, not in the caption — the LLM is told this but the publisher doesn't enforce it |
| **LinkedIn** | Hashtags appended with `\n\n` | Inline hashtags are correct for LinkedIn but bold/italic markers (`**text**`) should be stripped — LinkedIn's API ignores markdown and renders it as literal characters |
| **Telegram** | `parse_mode: Markdown` set | Correct, but the LLM output must use Telegram's specific Markdown subset (e.g. `*bold*` not `**bold**`) — no sanitisation is applied before sending |
| **Facebook** | Falls to `default` throw — not implemented | Needs plain text, no markdown, hashtags inline, 400 char soft limit enforced |
| **TikTok** | Falls to `default` throw — not implemented | Caption + 3–5 hashtags, 2200 char limit, hook must appear before the "more" fold (~100 chars) |
| **Threads** | Not in schema | Same caption rules as Instagram — hashtags in first comment, visual-first framing |
| **Bluesky** | Not in schema | 300 char limit, hashtags as native facets (not appended text), links as embed cards |
| **Discord** | Not in schema | Supports full Markdown (bold, italic, code blocks, headers) — format accordingly |
| **Reddit** | Not in schema | Title + body structure, Markdown body, no inline hashtags — post to specific subreddit |
| **YouTube** | Not in schema | Description formatting: chapters via timestamps, hashtags in description body, first 100 chars are the visible preview |
| **WhatsApp** | Not in schema | Bold via `*text*`, italic via `_text_`, no hashtags, links auto-preview |

**The fix: a `formatPostForPlatform` function**

Add a pure formatter that runs between content generation and publishing. It receives the raw copywriter output (`content`, `hashtags`, `mediaUrls`) and returns a `FormattedPost` shaped for each platform's actual API contract:

```typescript
// apps/api/src/services/posting/formatter.ts

export interface FormattedPost {
  primaryText: string        // main caption / body / tweet text
  firstComment?: string      // Instagram / Threads hashtag comment
  hashtags?: string[]        // platforms that take hashtags as separate fields
  markupMode?: 'markdown' | 'html' | 'none'
  segments?: string[]        // for threads / carousels (future)
  truncated: boolean         // flag if content was cut to fit the limit
}

export function formatPostForPlatform(
  platform: Platform,
  content: string,
  hashtags: string[],
): FormattedPost
```

**Per-platform formatting rules for the formatter:**

- **X** — enforce 280 chars; if over limit, trim content to fit, preserve hashtags (max 2) at the end; set `truncated: true` and log it
- **Instagram / Threads** — caption is content only (no hashtags); hashtags go in `firstComment` joined by spaces; double line breaks preserved; 2200 char cap on caption
- **LinkedIn** — strip markdown syntax (asterisks, underscores) from content before sending; append max 3 hashtags inline at end separated by spaces; enforce 3000 char limit
- **Telegram** — sanitise to Telegram Markdown v1 subset: `*bold*`, `_italic_`, `` `code` ``, `[text](url)`; strip unsupported syntax; no character limit
- **Facebook** — strip all markdown; hashtags inline at end; soft warn if over 400 chars
- **TikTok** — ensure hook is within first 100 chars (before "more" fold); 3–5 hashtags appended; 2200 char cap
- **Bluesky** — enforce 300 char limit including hashtags; hashtags as plain text (facet encoding handled by social-mcp); no markdown
- **Discord** — pass through standard Markdown (bold `**`, italic `*`, code blocks, headers); no hashtags
- **Reddit** — split content into `title` (first line, 300 char max) and `body` (remainder, Markdown); no hashtags
- **YouTube** — first 100 chars become the visible preview snippet; chapters formatted as `00:00 Section name`; hashtags in body at end
- **WhatsApp** — convert `**bold**` → `*bold*`, `*italic*` → `_italic_`; strip hashtags; 4096 char limit
- **Slack** — convert Markdown to Slack mrkdwn: `**bold**` → `*bold*`, `` `code` `` unchanged, `[text](url)` → `<url|text>`; no hashtags

**Where it plugs in:**

`executor.ts` calls `publishToplatform` → insert `formatPostForPlatform` before the `publishPost` call so every platform gets correctly shaped text. The copywriter output is never sent raw to an API again.

**Also update `prompt-builder.ts`:**
Add new platform rules for Threads, Bluesky, Discord, Reddit, YouTube, WhatsApp, and Slack to `PLATFORM_RULES` so the LLM generates content that aligns with what the formatter will enforce.

---

### TikTok and Facebook are not implemented — social-mcp is not used at all

`publishPost` in [apps/api/src/services/posting/social-mcp.ts](apps/api/src/services/posting/social-mcp.ts) only handles `x`, `instagram`, `linkedin`, and `telegram`. Both `tiktok` and `facebook` fall to the `default` throw (`"Platform X not yet supported"`), meaning any scheduled TikTok or Facebook post will fail at execution time despite being valid in the schema.

More broadly, **no platform is using the `social-mcp` npm package**. The file contains fully hand-rolled `fetch` calls and has a TODO comment at the top explicitly saying to migrate. social-mcp v1.7.0 is now available and covers all six current platforms plus eight more.

**What needs to be done:**
1. Install `social-mcp` as a dependency in `apps/api`.
2. Replace `social-mcp.ts` with a thin adapter that instantiates `SocialMCP` with the org's access token and proxied agent, then delegates all `publishPost` and `fetchEngagementData` calls to it.
3. This immediately unblocks TikTok and Facebook, and makes adding the new platforms (Discord, WhatsApp, Slack, Reddit, Threads, Bluesky, Mastodon, YouTube) a matter of adding cases to the `platformEnum` and strategy routing — not writing new API clients.
