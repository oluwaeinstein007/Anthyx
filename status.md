# Anthyx — Build Status

> Audited: April 25, 2026. Cross-referenced against `improvement.md` and the live codebase.

---

## Done ✅

### Folder Structure (§10)
- `apps/api` → `api/` rename complete
- `pnpm-workspace.yaml` and root `package.json` workspaces are in sync — both list `api`, `admin`, `affiliate`, `services/*`, `frontend`, `packages/*`

### Admin Dashboard (§1) — partial
- App exists at `admin/` with pages: `/dashboard`, `/organizations`, `/organizations/[id]`, `/users`, `/subscriptions`, `/posts`, `/audit-log`, `/feature-flags`, `/affiliates`, `/promo-codes`, `/analytics`
- `routes/admin.ts` exists and is mounted in `api/src/index.ts`
- DB: `is_super_admin` on users table, `feature_flags` table — migration 0009

### Affiliate Dashboard (§2) — partial
- App exists at `affiliate/` with pages: `/dashboard`, `/links`, `/conversions`, `/earnings`, `/apply`, `/login`
- `routes/affiliates.ts` exists and is mounted
- DB: `affiliates`, `affiliate_links`, `affiliate_conversions` tables — migration 0009

### Campaigns (§3)
- `campaignId` added to `GeneratePlanSchema` in `packages/config/src/schemas.ts`
- `campaignId` accepted in `PUT /plans/:id`
- Campaign `status`, `startDate`, `endDate` fields added — migration 0009
- Plans list rendered on campaign detail page (`campaigns/[id]/page.tsx`) with "New plan" shortcut button

### Competitive Gaps (§4) — partial
- **§4.1 Unified Engagement Inbox** — `GET /inbox` and `POST /inbox/:messageId/reply` fully implemented using social-mcp services directly (Discord, Slack, Twitter/X, Mastodon, Instagram, Facebook, LinkedIn, Threads); `fetchAndReplyToInbox` in `auto-reply.ts` is live (replaces stub)
- **§4.3** Image preview in HITL review: `PostPreview.tsx` renders `mediaUrls[0]`; `ApprovalBuffer` passes it through
- **§4.3** `POST /posts/:id/regenerate-image` route built
- **§4.6** A/B test UI: `/dashboard/ab-tests` page exists with variant comparison and winner promotion

### Authentication (§5.1) — partial
- Email verification on register — fully wired (send + verify token + `email_verified` flag)
- Password reset — fully wired (send + reset token flow)

### Billing (§5.2) — partial
- Annual billing toggle on upgrade page
- `POST /billing/validate-promo` route with discount preview

### Plans (§5.3) — partial
- `campaignId` passthrough in plan generation and update

### Analytics (§5.5) — partial
- `GET /analytics/posts` — paginated posts sorted by engagement rate
- `GET /analytics/posts/:postId` — single post detail with all metrics

### API Infrastructure (§6.1)
- Rate limiting: `express-rate-limit`, 100 req/min per IP on `/v1`
- CORS: configured for `DASHBOARD_URL` env var (not wildcard)
- Health check: `GET /health` returns `{ status, db, redis, ts }`

### Email Marketing & Pinterest DB/Routes (§8)
- `email_campaigns`, `rss_feeds`, `feed_items` tables — migration 0009
- `routes/email-campaigns.ts` and `routes/feeds.ts` mounted
- `/dashboard/email` and `/dashboard/inbox` frontend pages exist
- `pinterest` and `email` added to `Platform` enum

### Promo Codes (§9)
- `promo_codes` DB table — migration 0009
- `POST /billing/validate-promo` wired in billing route
- `/admin/promo-codes` admin page exists

---

## Not Done / Incomplete ❌

### Admin Dashboard — Missing pages (§1)
| Page | Status |
|---|---|
| `/admin/billing` | ✅ Done — subscription list + tier stats |
| `/admin/billing/invoices` | ✅ Done — billing stats endpoint (`/admin/billing/stats`) |
| `/admin/plans` | ✅ Done — feature matrix table |
| `/admin/queues` (BullMQ monitor) | ✅ Done — live counts per queue |
| `/admin/agents` | ✅ Done — list all agents, silence/resume |
| `/admin/email-templates` | ✅ Done — template browser with variable reference |
| `/admin/support` | ✅ Done — runbook + common issues |
| `/admin/settings` | ✅ Done — env var reference |
| `/admin/users/[id]` | ✅ Done — detail + subscription + impersonation |

### Affiliate Dashboard — Missing pages (§2)
| Page | Status |
|---|---|
| `/affiliate/dashboard/payouts` | ✅ Done — balance + payout history + request payout |
| `/affiliate/dashboard/resources` | ✅ Done — copy snippets, banner sizes, guides |
| `/affiliate/dashboard/settings` | ✅ Done — name + Stripe account ID |

### Competitive Gaps (§4)
- **§4.2 Per-post analytics drill-down** — ✅ Best-performers table now on analytics page (top 10 by engagement rate with likes/comments/impressions)
- **§4.4 SEO Layer** — entirely absent (no readability scoring, no keyword suggestion API)
- **§4.5 RSS feed auto-ingestion** — ✅ `feeds.worker.ts` created; repeatable BullMQ job runs every hour, upserts feed items by URL dedup

### Authentication (§5.1)
| Item | Status |
|---|---|
| Google OAuth (`GoogleProvider`) | Missing |
| Two-factor auth (TOTP) | Missing |
| API key management (table + routes) | Missing |
| Session revocation / JWT Redis denylist | Missing |

### Billing (§5.2)
| Item | Status |
|---|---|
| Trial-to-paid conversion email (3 days before trial ends) | Missing |
| Dunning — `invoice.payment_failed` webhook + email sequence | Missing |
| Paused subscription grace period | Missing |
| Invoice PDF download | Missing |
| Proration preview before upgrade | Missing |
| Enterprise quote / contact-sales flow | Missing |
| Promo code input field on `/dashboard/billing/upgrade` | ✅ Done — validates via `/billing/validate-promo`, shows discount label |

### Posts & Planning (§5.3)
| Item | Status |
|---|---|
| `/dashboard/posts/` page (posts list) | ✅ Done — lists all posts with status filter, pagination, engagement rate; backed by new `GET /posts` endpoint |
| Content calendar (30-day view) on plan detail | Missing |
| Post preview — platform mockup before approving | Missing |
| Drag-and-drop reschedule | Missing |
| Content recycling — re-queue top performers | Missing |
| Post versioning — store edits as audit trail | Missing |
| Post failure alerts (email/webhook on `status = failed`) | ✅ Done — `post.worker.ts` now fires `post_failed` notification job on failure; routed to registered webhooks |
| Bulk approve UI (route exists) | Unconfirmed |

### Agents (§5.4)
| Item | Status |
|---|---|
| Auto-reply UI toggle in agent settings | Missing |
| Agent cloning | Missing |
| Per-agent guardrail overrides | Missing |

### Analytics & Reporting (§5.5)
| Item | Status |
|---|---|
| Platform breakdown chart (X vs LinkedIn vs Instagram) | Missing |
| Best posting times heatmap | Missing |
| Hashtag analytics | Missing |
| Competitor analysis UI (MCP tool exists, no UI) | Missing |
| Exportable CSV/PDF reports button | Missing |

### Team & Collaboration (§5.6)
| Item | Status |
|---|---|
| Comments on posts UI (DB table `post_comments` exists) | Missing |
| Notification preferences per user | Missing |
| @mentions in post comments | Missing |

### Brand & Content (§5.7)
| Item | Status |
|---|---|
| Tone slider UI | Missing |
| Brand health score | Missing |
| Multi-language support | Missing |

### Social Accounts (§5.8)
| Item | Status |
|---|---|
| Account health check — surface expired/invalid tokens | Missing |
| Multi-account per platform | Missing |

### Technical Debt (§6)
| Item | Status |
|---|---|
| Sentry error monitoring (`@sentry/node`) | Missing — not in package.json or index.ts |
| Structured request logging (Pino / Winston) | Missing |
| OpenAPI / Swagger docs | Missing |
| Dead-letter queues for all workers | Unconfirmed |
| Unit tests (Vitest) | Missing |
| Integration tests | Missing |
| E2E tests (Playwright) — register → brand → plan → approve | Missing |
| GitHub Actions CI (type-check → lint → test on PR) | Unconfirmed |
| DB migration in CI against test Postgres | Missing |
| Log aggregation (Pino → Loki / Datadog) | Missing |
| Uptime monitoring for `/health` | Missing |
| Root `config.ts` — still exists; should be deleted after merging into `packages/config/src/index.ts` | Not done |

---

## Priority Order (from §11)

### Immediate
1. Verify all frontend pages are wired to API — especially missing `posts/` page
2. Sentry error monitoring
3. ~~Inbox — wire social-mcp read tools to replace stub~~ ✅ Done — social-mcp services wired into `GET /inbox` and `POST /inbox/:messageId/reply`

### Short-term (1–4 weeks)
4. Missing admin pages — billing, queues, agents, email-templates, support, settings, users/[id]
5. Missing affiliate pages — payouts, resources, settings
6. Campaign detail: render plans list, add "New plan" shortcut
7. Email verification guard on login (block unverified users or warn)
8. Trial-to-paid conversion email
9. Dunning flow
10. Promo code input on upgrade page

### Medium-term (1–3 months)
11. Google OAuth
12. Per-post analytics drill-down UI
13. Post failure alerts
14. Competitor analysis UI
15. A/B test UI improvements
16. SEO readability scoring
17. RSS feed worker verification
18. 2FA / TOTP

### Long-term
19. Mobile app / PWA
20. White-label portal
21. Social listening
22. CRM / content-to-conversion tracking
23. Zapier integration
24. Multi-workspace support
