# Anthyx — Improvement & Roadmap

> Status as of May 2026. Covers what still needs to be built, updated, or fixed.
>
> **Last updated:** 2026-05-04. Items confirmed implemented have been removed.

---

## 1. Campaigns — Remaining Gaps

### What's still missing

| Item                                              | What to do                                                                                                                                             |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Budget spend tracking**                         | `budgetCapCents` is stored but never decremented or compared. Either remove the field or define what "spend" means and implement tracking.              |
| **Campaign status lifecycle UI**                  | DB enum `active/completed/archived` exists; add a status dropdown on the campaign detail page to transition it.                                        |

---

## 2. Competitive Feature Gaps (Remaining)

### 2.1 AI Image Generation UI — **MEDIUM / Verify**

`POST /posts/:id/regenerate-image` and `POST /posts/:id/upload-media` are built. Verify in the review page (`/dashboard/review`) that the image preview and regenerate button are wired correctly.

### 2.2 SEO Layer — **MEDIUM / Absent**

**What competitors have:** Jasper integrates SurferSEO for keyword suggestions and readability scoring inline in the writing flow.

**What Anthyx has:** Nothing. No keyword tooling, no readability scoring, no SEO integration.

**What to build:**

- Add a readability score to the post review page (Flesch-Kincaid via a lightweight npm package — no external API needed)
- Add `GET /v1/seo/keywords?topic=X&brand=Y` — calls web search trends tool + LLM to suggest 5-10 keywords
- Surface keyword suggestions and readability score in the HITL editor as a sidebar panel (informational only)

### 2.3 CRM / Content-to-Conversion Tracking — **LATER / Absent**

**What competitors have:** Copy.ai connects marketing content to sales pipeline outcomes.

**What Anthyx has:** `postAnalytics` tracks engagement (likes, shares) but not downstream conversion events.

**What to build (enterprise tier):**

- Add `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` fields to post generation — auto-append UTM params to links in posts
- Webhook receiver for conversion events from CRMs (HubSpot, Salesforce)
- Attribution model: match conversion events to post UTM params
- Surface in analytics: "posts that drove conversions this month"

### 2.4 Plagiarism / Originality Check — **LATER / Absent**

**What competitors have:** Jasper includes a Copyscape plagiarism check on generated content.

**What Anthyx has:** The reviewer agent checks brand-voice adherence but not originality.

**What to build:** Call Copyscape SERP API or similar before sending content to HITL approval — flag if similarity score exceeds threshold. Block or warn in the review queue.

---

## 3. Missing Features in Existing Apps

### 3.1 Authentication (`api/` + `frontend/`)

| Item                           | Status                                                                                     | What to do                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Password reset                 | Frontend pages exist (`forgot-password/`, `reset-password/`), need to verify wiring to API | Test end-to-end                                                                         |
| 2FA setup UI                   | Backend TOTP routes built (`/auth/totp/setup`, `/enable`, `/disable`, `/verify`)           | Add frontend settings page for 2FA: show QR code, enter confirmation token              |
| API key management             | Missing                                                                                    | Users create API keys for CLI / integrations (table: `api_keys`, hashed)                |
| Session revocation             | Missing                                                                                    | JWT is stateless — add a Redis denylist for logout + password change                    |

### 3.2 Billing (`api/src/routes/billing.ts` + `services/billing/`)

| Item                               | Status                                   | What to do                                                                                  |
| ---------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------- |
| Overage invoicing                  | Done (`overage.ts`, `overage.worker.ts`) | Verify cron fires correctly                                                                 |
| Paused subscription (grace period) | Missing                                  | Add `suspended` grace period before cancelling access                                       |
| Invoice PDF download               | Frontend only                            | Stripe `/billing/invoices` returns `invoice_pdf` URL — add download button in billing UI   |
| Enterprise quote flow              | Missing                                  | Enterprise tier = custom pricing — add "Contact sales" CTA with Cal.com embed or email form |

### 3.3 Posts & Planning

| Item                           | Status                                            | What to do                                                               |
| ------------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------ |
| Post preview (platform mockup) | Missing                                           | Render how post will look on X, LinkedIn, Instagram before approving     |
| Drag-and-drop reschedule       | Missing                                           | Calendar drag to reschedule a post; backend `POST /posts/:id/reschedule` exists |
| Content recycling              | Missing                                           | "Re-publish best posts" — surface top performers by engagement, re-queue |

### 3.4 Agents

| Item                          | Status                         | What to do                                                                  |
| ----------------------------- | ------------------------------ | --------------------------------------------------------------------------- |
| Auto-reply UI                 | `auto-reply.ts` service exists | Add toggle in agent settings: enable auto-reply, configure tone for replies |
| Agent performance scoring     | `scorer.ts` exists             | Surface score in agent detail page (which voice traits drive engagement)    |
| Agent cloning                 | Missing                        | Duplicate an agent with all its settings to a new brand                     |
| Diet instruction UI           | DB field exists                | Verify the agents/[id] page has a text area for diet instructions           |
| Per-agent guardrail overrides | Missing                        | Agents inherit org guardrails — add per-agent additional restrictions       |

### 3.5 Analytics & Reporting

| Item                         | Status  | What to do                                                           |
| ---------------------------- | ------- | -------------------------------------------------------------------- |
| Best posting times           | Missing | Heatmap of engagement by day/hour from historical data               |
| Hashtag analytics            | Missing | Which hashtags drive most reach — aggregate from `postAnalytics`     |
| Usage analytics (admin-only) | Missing | Separate from post analytics — track feature adoption across orgs    |

### 3.6 Team & Collaboration

| Item                     | Status                                                 | What to do                                                                   |
| ------------------------ | ------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Comments on posts        | Missing                                                | Reviewers should be able to leave comments on posts before approving/vetoing |
| Notification preferences | Missing                                                | Per-user setting: get notified on post approval, failure, new plan           |
| @mentions in comments    | Missing                                                | Tag team members in post comments                                            |

### 3.7 Brand & Content

| Item                         | Status                    | What to do                                                              |
| ---------------------------- | ------------------------- | ----------------------------------------------------------------------- |
| Content pillar configuration | Missing                   | Let users define their content pillars (Education 40%, Promo 20%, etc.) |
| Tone slider UI               | Missing                   | Visual slider for brand tone (formal ↔ casual, serious ↔ playful)       |
| Brand health score           | Missing                   | Score how consistent generated content is with brand guidelines         |
| Multi-language support       | Missing                   | Agent should generate content in brand's target language(s)             |

### 3.8 Social Accounts

| Item                             | Status                             | What to do                                                             |
| -------------------------------- | ---------------------------------- | ---------------------------------------------------------------------- |
| Account health check             | Missing                            | Surface expired/invalid tokens proactively on the accounts page        |
| Multi-account per platform       | Missing                            | Some orgs run multiple X accounts — allow per-agent account assignment |
| Platform-specific limits display | `PLATFORM_CONSTRAINTS` type exists | Show char limit, hashtag limit inline in post editor                   |

---

## 4. Technical Debt & Infrastructure

### 4.1 API

| Item                                     | Status  | Fix                                                                                |
| ---------------------------------------- | ------- | ---------------------------------------------------------------------------------- |
| Rate limiting                            | Missing | Add `express-rate-limit` — 100 req/min per org                                     |
| CORS configuration                       | Unknown | Verify `cors()` is configured for production domain (not `*`)                      |
| Request logging                          | Unknown | Add Pino/Winston structured logging — critical for debugging production issues     |
| Error monitoring                         | Missing | Add Sentry SDK (`@sentry/node`) — captures unhandled errors with stack traces      |
| OpenAPI / Swagger docs                   | Missing | Generate from Zod schemas using `zod-openapi` — unblocks API consumers             |
| Health check endpoint                    | Unknown | Add `GET /health` returning `{ status: 'ok', db: true, redis: true }`              |
| `config.ts` at monorepo root             | Unknown | Move into `packages/config/src/index.ts` and delete root file                     |
| Database connection pooling              | Unknown | Verify postgres.js pool size is tuned for production load                          |

### 4.2 Frontend (`frontend/`)

| Item                  | Status                                     | Fix                                                                     |
| --------------------- | ------------------------------------------ | ----------------------------------------------------------------------- |
| Error boundaries      | Missing                                    | Add `error.tsx` per route segment for graceful error display            |
| Loading skeletons     | Unknown                                    | Add `loading.tsx` for all data-heavy pages (plans, posts, analytics)    |
| Empty states          | Unknown                                    | Every list page needs a friendly empty state with a CTA                 |
| Toast notifications   | Unknown                                    | Add `sonner` or `react-hot-toast` for action feedback                   |
| Form validation       | Unknown                                    | Zod + `react-hook-form` on all forms — match API Zod schemas            |
| Mobile responsiveness | Unknown                                    | Test all pages at 375px — sidebar needs a hamburger menu on mobile      |
| Dark mode             | Unknown                                    | Add `dark:` Tailwind variants                                           |
| Keyboard shortcuts    | Missing                                    | `k` for command palette, `n` for new post, `r` for review queue         |
| Optimistic UI updates | Missing                                    | TanStack Query `useMutation` with `onMutate` for instant UI feedback    |
| Accessibility (a11y)  | Unknown                                    | ARIA labels on icon buttons, focus traps in modals, keyboard navigation |

### 4.3 Workers

| Item                     | Status  | Fix                                                                 |
| ------------------------ | ------- | ------------------------------------------------------------------- |
| `overage.worker.ts`      | Exists  | Verify cron schedule (nightly 2am) is correctly configured          |
| `ingestor.worker.ts`     | Exists  | Verify it handles PDF/URL parsing failures gracefully (retry + DLQ) |
| `notification.worker.ts` | Exists  | Verify webhook delivery retries on failure (exponential backoff)    |
| Dead-letter queues       | Unknown | Add DLQ for all workers — failed jobs should not silently disappear |
| Worker health metrics    | Missing | Expose BullMQ queue depths to the admin dashboard                   |

### 4.4 Testing

| Item              | Status  | Fix                                                                                   |
| ----------------- | ------- | ------------------------------------------------------------------------------------- |
| Integration tests | Missing | Test full agent pipeline against a test DB                                            |
| E2E tests         | Missing | Playwright for critical paths: register → create brand → generate plan → approve post |
| Load testing      | Missing | k6 or Artillery for post-execution worker under load                                  |

### 4.5 DevOps / CI

| Item                                       | Status                        | Fix                                                     |
| ------------------------------------------ | ----------------------------- | ------------------------------------------------------- |
| GitHub Actions CI                          | Unknown                       | Add: install → type-check → lint → test on every PR     |
| DB migration in CI                         | Missing                       | Run `db:migrate` in CI against a test Postgres instance |
| Docker image tagging                       | Unknown                       | Tag with git SHA for traceable deployments              |
| Environment variable validation at startup | Partially done (`schemas.ts`) | Confirm it throws loudly if required vars are missing   |
| Log aggregation                            | Missing                       | Configure Pino → Loki or Datadog for production         |
| Uptime monitoring                          | Missing                       | Add BetterUptime or UptimeRobot for `/health` endpoint  |

---

## 5. New Features (Future Roadmap)

| Feature                                     | Why                                                                                                                                                                                                        |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Content library / templates**             | Users save high-performing post formats to reuse — reduces reliance on agents for routine content                                                                                                          |
| **Onboarding wizard**                       | Step-by-step setup: connect brand → ingest docs → connect account → generate first plan. Reduces time-to-value                                                                                             |
| **In-app notification center**              | Bell icon with unread count — post approved, post failed, plan ready, usage warning                                                                                                                        |
| **AI caption editor**                       | Inline "Improve this caption" / "Make it shorter" buttons on individual posts in HITL queue                                                                                                                |
| **White-label portal**                      | Agency tier: custom subdomain (`agency.client.com`), replace Anthyx branding with client branding                                                                                                          |
| **Multi-workspace**                         | Enterprise: manage multiple independent workspaces under one billing account                                                                                                                               |
| **Mobile app (React Native / PWA)**         | Approve/veto posts from phone — HITL reviewers especially need this                                                                                                                                        |
| **Zapier / Make integration**               | Connect Anthyx to 1000+ apps via webhooks                                                                                                                                                                  |
| **AI trend briefing**                       | Weekly email digest: "Here are the trending topics in your niche this week" — powered by Strategist                                                                                                        |
| **Post scheduling conflict detection**      | Warn when two posts are scheduled within 2 hours on the same account                                                                                                                                       |
| **Content gap analysis**                    | "You haven't posted about [pillar] in 14 days" — surface in dashboard                                                                                                                                      |
| **Social listening**                        | Monitor brand mentions across platforms → surface in analytics                                                                                                                                             |
| **Sentiment analysis on comments**          | Classify comment sentiment on published posts → feed back into agent voice tuning                                                                                                                          |
| **Commission/revenue share for agencies**   | White-label agencies resell seats — track sub-org revenue, compute agency's share                                                                                                                          |
| **Ideas board**                             | Scratchpad for content ideas before they become full plans. Table: `ideas (id, orgId, brandId, title, notes, status)`. Lightweight CRUD, no agent needed.                                                  |
| **Hashtag manager**                         | Save/organise branded hashtag sets per brand. Auto-attach a set to post generation.                                                                                                                        |
| **First comment scheduling (configurable)** | `social-mcp.ts` posts hashtags as first comment on Instagram + Threads. Extend to be user-configurable on any supporting platform (LinkedIn, Facebook).                                                    |
| **Google Docs / OneDrive export**           | Export generated posts directly to a Google Doc or OneDrive file.                                                                                                                                          |

---

## 6. Social MCP — Verification Checklist

`social-mcp` tools are built into `services/mcp/src/index.ts`. Verify:

- [ ] `social-mcp` package is registered as a Docker service in `docker-compose.yml` and `docker-compose.prod.yml`
- [ ] Pinterest env var (`PINTEREST_ACCESS_TOKEN`) is in `.env.example` and set in production
- [ ] Mail env vars (`MAIL_MAILER`, `MAIL_FROM_ADDRESS`, `MAIL_HOST`, etc.) are in `.env.example`
- [ ] `fetchAndReplyToInbox` in `auto-reply.ts` uses `social-mcp` read tools (`SEARCH_TWEETS`, `GET_INSTAGRAM_POSTS`, etc.) rather than the original stub

---

## 7. Folder Structure — Remaining Items

| Item                           | Fix                                                                                                                                                                                                                                                                                                   |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config.ts` at monorepo root   | Move contents into `packages/config/src/index.ts` and delete the root file                                                                                                                                                                                                                            |
| Root workspace sync            | Verify `pnpm-workspace.yaml` and root `package.json` workspaces list are in sync — should list `["api", "admin", "affiliate", "frontend", "services/*", "packages/*"]` explicitly                                                                                                                      |
| `services/agent/`              | Currently **disabled** — it competes with `api` workers on the same BullMQ queues and has bugs. Either fix it properly or delete it. Dead disabled code is a maintenance liability.                                                                                                                   |
| `docs/` folder                 | `structure.md`, `technical.md`, `StackUpdate.md` — verify these are up to date or consolidate into `README.md` and `architecture.md` at root                                                                                                                                                          |

---

## 8. Priority Order

### Immediate (launch blockers)

1. Request logging (Pino/Winston) — Sentry + rate limiting + CORS + health check are done
2. Verify password reset end-to-end
3. Verify social-mcp Docker service + Pinterest and mail env vars (§6)
4. Verify AI image display/regenerate in review page (§2.1)

### Short-term (1–4 weeks)

5. 2FA setup UI — backend routes done, need QR code frontend settings page (§3.1)
6. Invoice PDF download button in billing UI (§3.2)
7. Basic onboarding wizard
8. Campaign status lifecycle UI (§1)

### Medium-term (1–3 months)

9. SEO readability scoring in post editor (§2.2)
10. Hashtag manager (§5)
11. Ideas board (§5)
12. Best posting times heatmap (§3.5)
13. Hashtag analytics (§3.5)
14. Content pillar configuration (§3.7)
15. Paused subscription grace period (§3.2)

### Long-term

25. Mobile app / PWA
26. White-label portal
27. Social listening
28. Zapier integration
29. Multi-workspace support
30. CRM / content-to-conversion tracking (§2.3)
31. Plagiarism checker (§2.4)
32. Google Docs / OneDrive export (§5)
33. `services/agent/` — fix or delete (§7)
