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

### TikTok and Facebook are not implemented — social-mcp is not used at all

`publishPost` in [apps/api/src/services/posting/social-mcp.ts](apps/api/src/services/posting/social-mcp.ts) only handles `x`, `instagram`, `linkedin`, and `telegram`. Both `tiktok` and `facebook` fall to the `default` throw (`"Platform X not yet supported"`), meaning any scheduled TikTok or Facebook post will fail at execution time despite being valid in the schema.

More broadly, **no platform is using the `social-mcp` npm package**. The file contains fully hand-rolled `fetch` calls and has a TODO comment at the top explicitly saying to migrate. social-mcp v1.7.0 is now available and covers all six current platforms plus eight more.

**What needs to be done:**
1. Install `social-mcp` as a dependency in `apps/api`.
2. Replace `social-mcp.ts` with a thin adapter that instantiates `SocialMCP` with the org's access token and proxied agent, then delegates all `publishPost` and `fetchEngagementData` calls to it.
3. This immediately unblocks TikTok and Facebook, and makes adding the new platforms (Discord, WhatsApp, Slack, Reddit, Threads, Bluesky, Mastodon, YouTube) a matter of adding cases to the `platformEnum` and strategy routing — not writing new API clients.
