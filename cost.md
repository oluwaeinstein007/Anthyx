# Anthyx — Full Running Cost Analysis

> Generated: 2026-05-05 · Updated: 2026-05-05
> Based on current codebase, architecture, and `.env` configuration.
> All prices in USD. AI pricing current as of mid-2025.
>
> **v2 corrections vs v1:**
> - AI models updated to actual deployed values (`gemini-2.5-flash-lite` across all agents)
> - Social platform API costs added (X/Twitter is a real paid cost; others free)

---

## 1. Architecture Overview (Cost-Relevant Services)

Anthyx is a Dockerised monorepo with **11 production containers** (2× API, 2× worker, 2× ingestor, 1× MCP, 1× dashboard, 1× admin, 1× affiliate, 1× nginx) backed entirely by managed cloud services.

### Container Map (docker-compose.prod.yml)

| Container | Replicas | Role |
|-----------|----------|------|
| `api` | 2 | Express REST API |
| `worker` | 2 | BullMQ workers (5 queues) |
| `ingestor` | 2 | Brand doc ingestion |
| `mcp` | 1 | Social MCP tool server |
| `dashboard` | 1 | User-facing Next.js app |
| `admin` | 1 | Super admin Next.js app |
| `affiliate` | 1 | Affiliate portal Next.js app |
| `nginx` | 1 | Reverse proxy / TLS termination |

---

## 2. AI Model Inventory

All three agents run on `gemini-2.5-flash-lite` (confirmed from `.env`). Claude is fallback only.

| Agent / Task | Primary Model | Fallback Model | Source File |
|---|---|---|---|
| Strategist (plan generation) | `gemini-2.5-flash-lite` | — | `agent/strategist.ts` |
| Copywriter (post drafting) | `gemini-2.5-flash-lite` | `claude-sonnet-4-6` | `agent/copywriter.ts` |
| Reviewer (compliance gate) | `gemini-2.5-flash-lite` | `claude-haiku-4-5-20251001` | `agent/reviewer.ts` |
| Image generation | `imagen-3.0-generate-002` | — | `assets/ai-generator.ts` |
| Brand embeddings (ingest + RAG) | `gemini-embedding-001` | — | `brand-ingestion/embedder.ts` |

---

## 3. AI Pricing Reference (Current Rates)

### Google AI (Gemini / Imagen)

| Model | Input (per 1M tokens) | Output (per 1M tokens) | Notes |
|---|---|---|---|
| `gemini-2.5-flash-lite` ✅ deployed | $0.075 | $0.30 | All three agents |
| `imagen-3.0-generate-002` | — | — | $0.04/image (any aspect ratio) |
| `gemini-embedding-001` | $0.025/1M | — | Negligible |

### Anthropic (Claude — fallback only)

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|---|---|---|
| `claude-sonnet-4-6` | $3.00 | $15.00 |
| `claude-haiku-4-5-20251001` | $0.25 | $1.25 |

> Claude adds <$0.0001/post in expected cost at <1% Gemini failure rate. Omitted from scenarios.

---

## 4. Per-Operation AI Cost Breakdown

### 4.1 Per Post Generated

**Copywriter (gemini-2.5-flash-lite)**
- 1,050 input + 300 output tokens
- `(1,050/1M × $0.075) + (300/1M × $0.30)` = **$0.000169/post**

**Reviewer (gemini-2.5-flash-lite, avg 1.15 calls)**
- 1,300 input + 150 output tokens per call
- **$0.000164/post**

**Total LLM per post: ~$0.00033**

**AI image (Imagen 3, ~35% of posts, Growth+ tiers only)**
- $0.04 × 35% = **$0.014/post blended**

**Template card (BannerBear, ~10% of posts)**
- $99/mo ÷ 2,000 images = **$0.005/post blended**

| Component | Cost/Post | % of AI cost |
|---|---|---|
| LLM (copywriter + reviewer) | $0.00033 | 1.7% |
| AI image (blended 35%) | $0.01400 | 73.7% |
| Template card (blended 10%) | $0.00050 | 2.6% |
| **Total per post (blended)** | **~$0.0149** | |
| **Text-only post (no image)** | **~$0.00033** | |

### 4.2 Per Plan Generation (30-day calendar)

- Phase 1+2: ~25K input + ~12.5K output tokens on `gemini-2.5-flash-lite`
- `(25,000/1M × $0.075) + (12,500/1M × $0.30)` = **$0.0055/plan**

### 4.3 Per Brand Ingestion

- ~100 chunks × `gemini-embedding-001` = **< $0.001/ingest** (negligible)

---

## 5. Infrastructure Cost Catalogue

### 5.1 Managed Services (Fixed / Semi-Fixed)

| Service | Purpose | Free Tier | Production Cost |
|---|---|---|---|
| **Neon PostgreSQL** | Primary database | 512MB | $19/mo → $69/mo → $700/mo |
| **Upstash Redis** | BullMQ queues + sessions | 10K cmds/day | $10/mo → $50/mo → $200/mo |
| **Qdrant Cloud** | Vector store (brand RAG) | 1M vectors | $0 → $25/mo → $300/mo |
| **Resend** | Transactional email | 100/day | $20/mo → $90/mo → $190/mo |
| **AWS S3 / DO Spaces** | Generated asset storage | — | $5/mo → $60/mo |
| **Cloudinary** | Image CDN + transforms | 25 credits/mo | $0 → $89/mo → $224/mo |
| **BannerBear** | Template card rendering | — | $49/mo → $99/mo → $249/mo |
| **Sentry** | Error monitoring | 5K errors/mo | $0 → $26/mo → $80/mo |

### 5.2 Social Platform API Costs

Each platform is called using **the user's own OAuth access token** — Anthyx does not share credentials. However, Anthyx must register a developer app on each platform, and some platforms charge for that app's API access tier.

| Platform | API Cost Model | Monthly Cost | Notes |
|---|---|---|---|
| **X / Twitter** | Paid per app tier | **$100–$5,000** | See below — the only material social API cost |
| **Instagram** | Meta Graph API | **$0** | App approval required, no fee |
| **Threads** | Meta Graph API | **$0** | Same app as Instagram |
| **Facebook** | Meta Graph API | **$0** | App approval required, no fee |
| **LinkedIn** | UGC Posts API v2 | **$0** | Free with app registration |
| **TikTok** | Content Posting API v2 | **$0** | App approval required |
| **Telegram** | Bot API (Anthyx-owned bot) | **$0** | Free; Anthyx runs one shared bot |
| **Discord** | Bot API | **$0** | Free; user provides their bot token |
| **WhatsApp Business** | Cloud API | **$0 base + variable** | Free for service msgs; $0.005–$0.09/conversation for marketing messages (user's WhatsApp account is billed, not Anthyx) |
| **Slack** | OAuth API | **$0** | Free |
| **Reddit** | OAuth API | **$0** | Free |
| **Bluesky** | AT Protocol | **$0** | Free and open |
| **Mastodon** | Instance API | **$0** | Free and open |
| **YouTube** | Data API v3 | **$0** | 10K quota units/day free |
| **Pinterest** | API v5 | **$0** | App approval required |

### X / Twitter API — The Cost Cliff

X eliminated free write access in 2023. The rate limit is **per app** (shared across all users), not per user.

| Tier | Monthly Cost | Write limit | Suitable for |
|---|---|---|---|
| Basic | $100 | 1,500 tweets/mo (app-wide) | Beta (<10 active X users) |
| Pro | $5,000 | 300,000 tweets/mo | Growth onwards |
| Enterprise | $42,000+ | Custom | Large scale |

**The problem**: 1,500 tweets/month shared across all users is exhausted fast. At 50 users with X connected, that's 30 tweets/user/month maximum — barely 1/day. As soon as you have more than ~10 active X posters, you hit the wall.

**Recommended approach**: Gate X posting behind **Agency+ tier** only (or as a paid add-on). This keeps X user count low enough to stay on Basic until revenue justifies Pro.

| Stage | X users (Agency+, 40% have X) | Monthly X posts | API tier needed |
|---|---|---|---|
| Beta (50 users) | ~4 | ~400 | Basic ($100) |
| Early Growth (200 users) | ~24 | ~3,600 | Basic if gated; Pro if open |
| Growth (1,000 users) | ~80 | ~30,000 | Pro ($5,000) |
| Scale (5,000 users) | ~400 | ~150,000 | Pro ($5,000) |

### 5.3 Variable / Third-Party Intel

| Service | Purpose | Starting Cost | Scale Cost |
|---|---|---|---|
| **Apify** | Instagram/LinkedIn competitor scraping | $49/mo | $499/mo |
| **SerpApi** | Share-of-voice, news mentions | $50/mo | $250/mo |
| **Tavily** | Web search for trend research | $30/mo | $100/mo |
| **Bright Data (proxies)** | IP rotation (Scale/Enterprise only) | ~$15/GB | ~$500/mo+ |
| **Stripe** | Payment processing | 2.9% + $0.30/txn | Negotiate at $500K+ MRR |

### 5.4 Compute (VPS / Cloud)

| Scale | Host | Config | Monthly |
|---|---|---|---|
| Seed / Beta | Hetzner | 2× CX31 (2 vCPU, 8GB) | ~$26 |
| Early Growth | Hetzner / DigitalOcean | 3× CPX31 (4 vCPU, 8GB) | ~$90 |
| Growth | DigitalOcean / Hetzner | 5× nodes or Managed K8s | ~$200–400 |
| Scale | AWS ECS / DigitalOcean K8s | Auto-scaling cluster | ~$800–2,000 |
| Enterprise | AWS EKS + RDS | Fully managed stack | ~$5,000–15,000 |

---

## 6. Pricing Tier Reference

| Tier | Monthly Price | Posts/Mo | Brands | Social Accounts | AI Images |
|---|---|---|---|---|---|
| Sandbox | $0 | 15 | 1 | 2 | No |
| Starter | $49 | 120 | 1 | 5 | No |
| Growth | $149 | 500 | 3 | 15 | Yes |
| Agency | $399 | 2,500 | 15 | 50 | Yes |
| Scale | $999 | 10,000 | Unlimited | 100 | Yes |
| Enterprise | Custom | Unlimited | Unlimited | Unlimited | Yes |

Overage: $0.04/post · $8.00/extra account · $25.00/extra brand

---

## 7. Scale Scenarios — Full Cost Model

> X API cost assumes X is **gated to Agency+ tier only** (recommended). This keeps Basic tier ($100) viable through early growth and delays the $5,000 Pro jump.

### Scenario A — Beta Launch (50 paying users)

**Assumed mix**: 25 Starter + 15 Growth + 10 Agency

| Category | Calculation | Monthly Cost |
|---|---|---|
| **Revenue** | 25×$49 + 15×$149 + 10×$399 | **$6,200** |
| LLM (all posts) | 9,350 × $0.00033 | $3 |
| AI images (Growth+, 35%) | 3,273 × $0.04 | $131 |
| Plan generation | 50 × $0.0055 | <$1 |
| **Total AI** | | **$134** |
| Compute (2× Hetzner CX31) | | $26 |
| Neon (Launch) | | $19 |
| Upstash Redis | | $10 |
| Qdrant (free tier) | | $0 |
| Resend | | $20 |
| S3 | | $5 |
| BannerBear Starter | | $49 |
| Sentry (free) | | $0 |
| **Total Infra** | | **$129** |
| Apify + SerpApi + Tavily | | $129 |
| **X API Basic** (gated to 10 Agency users, ~400 X posts) | | **$100** |
| Stripe (2.9% + $0.30×50) | | $195 |
| **Total Third-party** | | **$424** |
| | | |
| **Total COGS** | | **~$687/mo** |
| **Gross Profit** | | **$5,513** |
| **Gross Margin** | | **88.9%** |

Post volume: 25×60=1,500 · 15×250=3,750 · 10×410=4,100 → **9,350/month**

---

### Scenario B — Early Growth (200 paying users)

**Assumed mix**: 80 Starter + 70 Growth + 30 Agency + 20 Scale

| Category | Calculation | Monthly Cost |
|---|---|---|
| **Revenue** | 80×$49 + 70×$149 + 30×$399 + 20×$999 | **$56,270** |
| LLM (all posts) | 161,400 × $0.00033 | $53 |
| AI images (35%, Growth+) | 56,490 × $0.04 | $2,260 |
| Plan gen | 200 × $0.0055 | $1 |
| **Total AI** | | **$2,314** |
| Compute (3× CPX41) | | $144 |
| Neon (Scale tier) | | $69 |
| Upstash | | $50 |
| Qdrant Growth | | $25 |
| Resend Pro | | $90 |
| Cloudinary Plus | | $89 |
| S3 | | $15 |
| BannerBear Pro | | $99 |
| Sentry Team | | $26 |
| **Total Infra** | | **$607** |
| Apify + SerpApi + Tavily | | $129 |
| **X API — Basic if gated to Agency+ ($100) or Pro if open ($5,000)** | | **$100–$5,000** ⚠️ |
| Stripe (2.9% + $0.30×200) | | $1,692 |
| **Total Third-party (X Basic)** | | **$1,921** |
| | | |
| **Total COGS (X Basic, gated)** | | **~$4,842/mo** |
| **Gross Margin (X Basic)** | | **91.4%** |
| **Total COGS (X Pro, open to all)** | | **~$9,742/mo** |
| **Gross Margin (X Pro)** | | **82.7%** ⚠️ |

> The gap between gated ($100) and open ($5,000) X access is **$4,900/month** — nearly 9% of gross margin at this stage. Gate X to Agency+ until you hit $50K+ MRR comfortably.

Post volume: 80×80=6,400 · 70×300=21,000 · 30×1,200=36,000 · 20×4,900=98,000 → **161,400/month**

---

### Scenario C — Growth Stage (1,000 paying users)

**Assumed mix**: 400 Starter + 300 Growth + 200 Agency + 100 Scale

| Category | Calculation | Monthly Cost |
|---|---|---|
| **Revenue** | 400×$49 + 300×$149 + 200×$399 + 100×$999 | **$244,000** |
| LLM (all posts) | 1,022,000 × $0.00033 | $337 |
| AI images (35%, Growth+) | 357,700 × $0.04 | $14,308 |
| Plan gen | 1,000 × $0.0055 | $6 |
| **Total AI** | | **$14,651** |
| Kubernetes cluster (6 nodes) | | $800 |
| Neon Business | | $700 |
| Upstash Scale | | $200 |
| Qdrant Production | | $300 |
| Resend Scale | | $190 |
| Cloudinary Advanced | | $224 |
| S3 + CDN | | $60 |
| BannerBear Business | | $249 |
| Sentry Business | | $80 |
| **Total Infra** | | **$2,803** |
| Apify Scale | $499 | |
| SerpApi Business | $250 | |
| Tavily Pro | $100 | |
| Bright Data | $500 | |
| **X API Pro** (300 Agency+Scale users, ~30K X posts/mo) | **$5,000** | |
| Stripe (2.9% + $0.30×1,000) | $7,376 | |
| **Total Third-party** | | **$13,725** |
| | | |
| **Total COGS** | | **~$31,179/mo** |
| **Gross Profit** | | **$212,821** |
| **Gross Margin** | | **87.2%** |

Post volume: 400×80=32,000 · 300×300=90,000 · 200×1,500=300,000 · 100×6,000=600,000 → **1,022,000/month**

---

### Scenario D — Scale Stage (5,000 paying users + Enterprise)

**Assumed mix**: 2,000 Starter + 1,500 Growth + 1,000 Agency + 500 Scale + 10 Enterprise @ $25K avg

| Category | Calculation | Monthly Cost |
|---|---|---|
| **Revenue** | 2K×$49+1.5K×$149+1K×$399+500×$999+$250K | **~$1,465,000** |
| LLM (all posts) | ~5.5M × $0.00033 | $1,815 |
| AI images (30% w/ bulk discount) | 1.65M × $0.032 | $52,800 |
| Plan gen | 5,000 × $0.004 | $20 |
| **Total AI** | | **$54,635** |
| Kubernetes (20+ nodes, multi-region) | | $5,000 |
| Neon / AWS RDS | | $2,000 |
| Upstash Enterprise | | $500 |
| Qdrant Self-hosted | | $500 |
| Resend Enterprise | | $500 |
| Cloudinary Enterprise | | $600 |
| S3 + CloudFront | | $300 |
| Other infra | | $1,000 |
| **Total Infra** | | **$10,400** |
| Third-party intel | $3,000 | |
| **X API Pro** (1,500 Agency+Scale users, ~150K X posts/mo, within 300K limit) | **$5,000** | |
| Stripe (negotiated 2.5%) | $36,625 | |
| **Total Third-party** | | **$44,625** |
| | | |
| **Total COGS** | | **~$109,660/mo** |
| **Gross Profit** | | **~$1,355,340** |
| **Gross Margin** | | **~92.5%** |

> At 5,000 users, Pro's 300K tweet/month cap is sufficient even at full Agency/Scale usage. No need to upgrade to Enterprise X API.

---

## 8. Summary — Gross Margin by Scale

| Stage | Users | MRR | COGS | Gross Margin | X API tier |
|---|---|---|---|---|---|
| Beta | 50 | $6,200 | $687 | **88.9%** | Basic ($100) |
| Early Growth | 200 | $56,270 | $4,842 | **91.4%** | Basic — gated to Agency+ |
| Growth | 1,000 | $244,000 | $31,179 | **87.2%** | Pro ($5,000) |
| Scale | 5,000 | $1,465,000 | $109,660 | **92.5%** | Pro ($5,000) |

**The X API cost cliff**: Upgrading from Basic ($100) to Pro ($5,000) is a $4,900/month step change. This happens when X posting demand exceeds 1,500 tweets/month app-wide. Gate X to Agency+ to delay this until you have the revenue to absorb it comfortably (target: $50K+ MRR before upgrading).

---

## 9. Unit Economics Per User (Growth Stage, 1,000 users)

X API Pro ($5,000) is spread across all 1,000 users as a fixed cost.

| Tier | ARPU/mo | LLM | Images | Infra | X API share | Stripe | COGS/user | Margin |
|---|---|---|---|---|---|---|---|---|
| Starter ($49) | $49 | $0.03 | $0 | $2.80 | $5.00 | $1.72 | $9.55 | **80.5%** |
| Growth ($149) | $149 | $0.10 | $4.20 | $2.80 | $5.00 | $4.62 | $16.72 | **88.8%** |
| Agency ($399) | $399 | $0.50 | $21.00 | $2.80 | $5.00 | $11.87 | $41.17 | **89.7%** |
| Scale ($999) | $999 | $1.98 | $84.00 | $2.80 | $5.00 | $29.27 | $123.05 | **87.7%** |

> X API cost hits Starter users disproportionately ($5 per $49 ARPU = 10.2% of revenue). This is another reason to gate X to Growth+ — Starter users shouldn't have access to a channel that costs you $5/user/month to maintain.

---

## 10. Top 5 Cost Drivers (Ranked, 1,000 users)

| Rank | Driver | % of COGS | Lever |
|---|---|---|---|
| 1 | **AI image generation (Imagen 3)** | ~46% | Cap images per tier; BannerBear for Growth; bulk discount at scale |
| 2 | **Stripe transaction fees** | ~24% | Annual billing (12 → 1 charge); volume agreement at $100K+ MRR |
| 3 | **X / Twitter API Pro** | ~16% | Gate X to Agency+; delay Pro upgrade until $50K+ MRR |
| 4 | **Infrastructure compute** | ~9% | Scale ingestor replicas down off-peak |
| 5 | **Third-party intel (Apify/Serp/Tavily)** | ~4% | Cache search results 24h in Redis |
| — | LLM text generation | ~1% | Already optimised (gemini-2.5-flash-lite) |

---

## 11. Cost Optimisation Recommendations

### Immediate

1. **Gate X posting to Agency+ tier** — At current stage, do not allow Starter/Growth users to post to X. This keeps you on Basic ($100) and avoids a premature $5,000/mo step. This is the single most impactful unimplemented change.

2. **Cache web search results 24h in Redis** — Tavily and SerpApi return near-identical results for same industry + keywords within a day. Add Redis cache in `web-search-trends` MCP tool. Saves ~$80/mo now, ~$1,000/mo at scale.

3. **Gate AI image generation enforcement** — Verify `content.worker.ts` checks `aiAssetGeneration` flag before calling `generateAIAsset`. Starter users must not trigger $0.04 images.

4. **Prompt caching on Claude fallback** — Add `cache_control: { type: "ephemeral" }` to system prompt in `llm-client.ts:37`. Saves ~80% on Claude fallback calls.

5. **Annual billing incentive (15–20% discount)** — Converts 12 monthly Stripe charges to 1. Saves ~$900/month at 1,000 users (30% on annual).

### Short-term (1–3 months)

6. **Add monthly image cap per tier** — No hard cap currently exists. A Scale user can generate thousands of images/month ($140+ in image costs). Add `maxAIImagesPerMonth` to `PlanTierConfig` and enforce in content worker.

7. **Offer X as a paid add-on ($15–25/mo)** — Rather than bundling X with Agency, sell it as an optional channel add-on. This directly offsets the X API cost and surfaces the real platform cost to users who want it.

8. **Upgrade to X Pro only when forced** — Monitor X API usage in admin dashboard. Upgrade when monthly tweets approach 1,200 (80% of Basic limit), not before.

### Medium-term (3–6 months)

9. **Negotiate Google AI committed-use** — At $1,000+/month on Google AI, 6-month committed-use contract yields 20–25% off. ~$3,600/year saving at 1,000 users.

10. **Self-host Qdrant** — At >5,000 brand collections, Qdrant OSS on a Hetzner CCX13 ($14/mo) replaces cloud Production tier ($300/mo). Saves $286/month.

11. **Negotiate Stripe volume pricing** — At $100K+ MRR, target 2.0–2.4% rate. Saves $2,500–5,000/month at 1,000 users.

### Long-term (6+ months)

12. **Fine-tune model on post corpus** — At 50,000+ approved posts, fine-tune a smaller Gemini model on top-performing content. Reduces reviewer retry rate, cutting image re-generation.

13. **In-house proxy pool** — Bright Data ($500+/mo) replaceable with residential VPS pool (~$100/mo) at Scale/Enterprise.

---

## 12. Break-even Analysis

### Fixed monthly overhead (before any users)

| Item | Cost |
|---|---|
| Compute (2× servers) | $80 |
| Neon Launch | $19 |
| Upstash | $10 |
| Resend | $20 |
| BannerBear Starter | $49 |
| Apify | $49 |
| SerpApi | $50 |
| Tavily | $30 |
| X API Basic | $100 |
| **Total fixed floor** | **$407/month** |

### Minimum paying users to cover fixed costs

- 1 Starter user = $49 revenue, ~$3.02 variable cost (LLM $0.03 + Stripe $1.72 + X API share $1.25*) = **$45.98 contribution**
- Break-even: `$407 / $45.98` = **~9 Starter users**

*X API Basic $100 ÷ 80 avg users = $1.25/user assumed at break-even scale.

### Minimum viable MRR for founder salary ($5,000/mo)

`($407 infra + $5,000 salary) / 0.889 margin` = ~$6,082 MRR = **~125 Starter users or 41 Growth users**

---

## 13. Overage Revenue Model

| Metric | Value |
|---|---|
| Overage price | $0.04/post |
| Cost to serve (LLM $0.00033 + blended image) | ~$0.0143/post |
| **Overage gross margin** | **64.2%** |

Overage is profitable but lower-margin than subscriptions (~89%). The gap is intentional — it drives tier upgrades.

- Account overage: $8.00/extra, near-zero incremental cost
- Brand overage: $25.00/extra, near-zero incremental cost

---

## 14. Cost Risks & Mitigations

| Risk | Severity | Probability | Mitigation |
|---|---|---|---|
| X API rate limit breach on Basic tier | High | High | Gate X to Agency+; monitor usage in admin dashboard |
| X API price increase (already happened once) | High | Medium | Add X as paid add-on to pass through cost; dual-posting optional |
| Imagen 3 price increase | High | Medium | Committed-use contract; BannerBear fallback path |
| Image cap abuse (no current cap) | High | Medium | Add `maxAIImagesPerMonth` to tier config immediately |
| Upstash Redis daily limit exhausted | High | Medium | Upgrade tier proactively; monitor queue depth |
| WhatsApp marketing message costs | Medium | Low | Billed to user's WhatsApp Business account, not Anthyx |
| gemini-2.5-flash-lite quality degradation | Medium | Low | Claude fallback already wired |
| Qdrant Cloud outage | Medium | Low | Degrade gracefully: copywriter runs without RAG context |
| Stripe rate hikes | Low | Low | Paystack already integrated as alternative |

---

## 15. Recommended Infrastructure Budget by Stage

| Stage | Users | Monthly Budget | Notes |
|---|---|---|---|
| Pre-launch | 0 | $407 | Includes X Basic |
| Beta | 1–50 | $700–1,000 | Add BannerBear + monitoring |
| Early traction | 50–200 | $1,300–2,700 | Upgrade Neon + Qdrant; hold X Basic if gated |
| Product-market fit | 200–1,000 | $10,000–32,000 | X Pro jump at ~$50K MRR; add K8s |
| Growth | 1,000–5,000 | $32,000–110,000 | Google committed-use; self-host Qdrant |
| Mature | 5,000+ | $110,000+ | Negotiate all vendor rates |

---

## 16. Nigeria Market Summary

See [costNGA.md](costNGA.md) for full analysis.

| | Global | Nigeria (NGN) |
|---|---|---|
| Starter price | $49/mo | ₦14,900/mo ($9.03) |
| Starter gross margin | 80.5% | ~80% |
| Break-even users | 9 Starter | ~51 Naira Starter |
| X API impact | $100 on $407 floor (25%) | $100 on $407 floor — same USD cost, proportionally heavier on NGN revenue |
| Payment processor | Stripe (2.9%) | Paystack (1.5%, cap ₦2,000) |

Paystack is fully integrated (`api/src/services/billing/paystack.ts`). X API gating is especially critical for Nigeria — see costNGA.md Section 7.
