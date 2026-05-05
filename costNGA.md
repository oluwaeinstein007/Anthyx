# Anthyx — Nigerian Market Cost & Pricing Analysis

> Generated: 2026-05-05 · Updated: 2026-05-05
> Reference exchange rate: ₦1,650 / $1 USD (NAFEX/CBN rate, May 2026)
> Paystack is already integrated (`api/src/services/billing/paystack.ts`) — no additional payment work needed.
> AI costs use **actual deployed models** from `.env`: `gemini-2.5-flash-lite` across all three agents.
> **v2**: Social platform API costs added — X/Twitter is a real paid USD cost that does not benefit from NGN pricing.

---

## Why a Separate Nigeria Analysis

Nigerian customers earn and budget in Naira. Your AI and infrastructure costs are billed in USD. This creates a **structural FX gap**: a ₦49,000 Starter plan feels like paying $49 to a US customer, but in Nigeria ₦49,000 is a significant monthly expense for an SMB. At ₦1,650/$1, the global $49 = ₦80,850 — far outside typical Nigerian SaaS budgets.

The good news: your actual per-post AI cost is **dramatically lower than the global cost.md assumes**, because you've already deployed `gemini-2.5-flash-lite` (not Pro). This means you can price aggressively for Nigeria and still run healthy margins.

---

## 1. Actual AI Cost Per Post (gemini-2.5-flash-lite)

The `.env` confirms all three agents run on `gemini-2.5-flash-lite`. Pricing:

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|---|---|---|
| `gemini-2.5-flash-lite` | ~$0.075 | ~$0.30 |

### Per-post breakdown

**Copywriter**: 1,050 input + 300 output tokens
`(1,050/1M × $0.075) + (300/1M × $0.30)` = $0.000079 + $0.000090 = **$0.000169**

**Reviewer** (avg 1.15 calls): 1,300 input + 150 output tokens × 1.15
`(1,300/1M × $0.075) + (150/1M × $0.30)` × 1.15 = **$0.000164**

**Total LLM per post: ~$0.00033** (less than ₦0.55 per post)

**Per plan generation** (30-day, 3 platforms = 90 items):
- Input ~25,000 tokens, output ~12,000 tokens
- `(25k/1M × $0.075) + (12k/1M × $0.30)` = $0.001875 + $0.003600 = **$0.0055/plan** (₦9.07)

**AI image (Imagen 3, $0.04/image)** — unchanged, billed by Google regardless of LLM model.

> The LLM cost is essentially negligible. Image generation is the only meaningful variable AI cost.

---

## 2. Paystack Fee Structure vs Stripe

| Fee Type | Paystack (Nigeria) | Stripe (Global) |
|---|---|---|
| Local card rate | 1.5% + ₦100 per charge | 2.9% + $0.30 |
| Local charge cap | ₦2,000 max per charge | No cap |
| International cards | 3.9% + ₦100 | 2.9% + $0.30 |
| Payout currency | NGN | USD |
| Settlement time | 1 business day | 2–7 business days |

**Effective Paystack fee on Nigerian pricing**:
- ₦15,000 charge: 1.5% = ₦225 + ₦100 = **₦325** ($0.20)
- ₦35,000 charge: 1.5% = ₦525 + ₦100 = **₦625** ($0.38) — cap kicks in at ₦133,333
- ₦85,000 charge: capped at ₦2,000 ($1.21)
- ₦200,000 charge: capped at ₦2,000 ($1.21)

The ₦2,000 cap is a significant advantage at higher tiers — Stripe would charge $11.90 on a $399-equivalent charge.

---

## 3. Social Platform API Costs (USD — Not NGN-Adjusted)

**This is the most important cost section for Nigeria.** Social platform API costs are billed in USD by the platforms directly, regardless of what Nigerian customers pay in NGN. A weak Naira does not reduce these costs.

| Platform | Anthyx pays? | Monthly Cost (USD) | NGN equiv (₦1,650/$) |
|---|---|---|---|
| **X / Twitter** | **YES** | $100–$5,000 | ₦165,000–₦8,250,000 |
| Instagram, Threads, Facebook | No | $0 | — |
| LinkedIn, TikTok, Reddit | No | $0 | — |
| Telegram (Anthyx-owned bot) | No | $0 | — |
| WhatsApp, Discord, Slack, Bluesky | No | $0 | — |

### X/Twitter API — Disproportionate burden on Nigerian revenue

X charges per developer app, not per user. At the minimum Basic tier ($100/mo), the app can only post **1,500 tweets/month total** across all users.

| X Tier | USD/mo | NGN equiv | % of NGA Beta MRR ($845) | % of NGA Growth MRR ($6,776) |
|---|---|---|---|---|
| Basic | $100 | ₦165,000 | **11.8%** | 1.5% |
| Pro | $5,000 | ₦8,250,000 | **591%** ❌ | **73.8%** ❌ |

**X Pro at $5,000 is not viable for the Nigerian market at any realistic scale.** It would consume more than the entire MRR of a 300-user Nigerian base. This is a hard constraint.

### Recommendation for Nigeria: Block X posting entirely until Pro is justified

| Option | When to use |
|---|---|
| **No X at all** | Early stage (<$10K MRR) — remove X from NGA tier feature list |
| **X Basic ($100), gated to Naira Agency+** | When MRR > ₦3,000,000/mo (~$1,800) — Basic is then <6% of revenue |
| **X Pro ($5,000)** | Only viable when NGA MRR exceeds ₦20,000,000/mo (~$12,000), i.e. ~700+ paying NGA users |

Until that point, present X as a "coming soon" platform for Nigerian users or route them through a separate global plan if they specifically need X.

---

## 4. Proposed Nigerian Pricing Tiers (NGN)

Pricing rationale: Nigerian SaaS tools typically run at 10–20% of US equivalents in USD terms due to PPP. Anthropic, Notion, and Figma all operate Nigeria-specific pricing at 15–25% of global rates.

| Tier | NGN/mo | USD equiv | Global USD | Discount vs Global | Posts/mo | AI Images |
|---|---|---|---|---|---|---|
| **Sandbox** | ₦0 | $0 | $0 | — | 15 | No |
| **Naira Starter** | ₦14,900 | $9.03 | $49 | 82% off | 120 | No |
| **Naira Growth** | ₦34,900 | $21.15 | $149 | 86% off | 500 | Yes (limited) |
| **Naira Agency** | ₦84,900 | $51.45 | $399 | 87% off | 2,500 | Yes |
| **Naira Scale** | ₦199,900 | $121.15 | $999 | 88% off | 10,000 | Yes |
| **Enterprise** | Custom | Custom | Custom | Negotiated | Unlimited | Yes |

### Annual pricing (15% discount, 2 months free)

| Tier | NGN/mo (annual) | Annual total |
|---|---|---|
| Naira Starter | ₦12,700 | ₦152,400 |
| Naira Growth | ₦29,700 | ₦356,400 |
| Naira Agency | ₦72,200 | ₦866,400 |
| Naira Scale | ₦169,900 | ₦2,038,800 |

---

## 4. Cost Per User at NGN Pricing

With gemini-2.5-flash-lite, the AI cost is so low that **infrastructure and Paystack fees dominate**, not LLM spend.

### Naira Starter (₦14,900/mo · $9.03)

| Cost Item | Amount | NGN equiv |
|---|---|---|
| LLM (120 posts × $0.00033) | $0.040 | ₦66 |
| AI images | $0 (not included) | — |
| Infrastructure per user (200 users) | $0.80 | ₦1,320 |
| Paystack fee (₦225 + ₦100) | $0.20 | ₦325 |
| **Total COGS** | **$1.04** | **₦1,716** |
| Revenue | $9.03 | ₦14,900 |
| **Gross Profit** | **$7.99** | **₦13,184** |
| **Gross Margin** | **88.5%** | |

### Naira Growth (₦34,900/mo · $21.15) — with limited AI images (50 images/mo cap)

| Cost Item | Amount | NGN equiv |
|---|---|---|
| LLM (500 posts × $0.00033) | $0.165 | ₦272 |
| AI images (50 × $0.04, capped) | $2.00 | ₦3,300 |
| Infrastructure per user | $0.80 | ₦1,320 |
| Paystack fee (₦525 + ₦100) | $0.38 | ₦625 |
| **Total COGS** | **$3.35** | **₦5,527** |
| Revenue | $21.15 | ₦34,900 |
| **Gross Profit** | **$17.80** | **₦29,373** |
| **Gross Margin** | **84.2%** | |

### Naira Agency (₦84,900/mo · $51.45) — full AI images

| Cost Item | Amount | NGN equiv |
|---|---|---|
| LLM (2,500 posts × $0.00033) | $0.825 | ₦1,361 |
| AI images (35% × 2,500 × $0.04) | $35.00 | ₦57,750 |
| Infrastructure per user | $0.80 | ₦1,320 |
| Paystack fee (capped at ₦2,000) | $1.21 | ₦2,000 |
| **Total COGS** | **$37.84** | **₦62,431** |
| Revenue | $51.45 | ₦84,900 |
| **Gross Profit** | **$13.61** | **₦22,469** |
| **Gross Margin** | **26.4%** ⚠️ | |

> **Agency margin is tight because image generation costs dominate.** See Section 7 for the fix.

### Naira Scale (₦199,900/mo · $121.15)

| Cost Item | Amount | NGN equiv |
|---|---|---|
| LLM (10,000 posts × $0.00033) | $3.30 | ₦5,445 |
| AI images (35% × 10,000 × $0.04) | $140.00 | ₦231,000 |
| Infrastructure per user | $0.80 | ₦1,320 |
| Paystack fee (capped at ₦2,000) | $1.21 | ₦2,000 |
| **Total COGS** | **$145.31** | **₦239,765** |
| Revenue | $121.15 | ₦199,900 |
| **Gross Profit** | **-$24.16** | **-₦39,865** |
| **Gross Margin** | **-19.9%** ❌ | |

> **Scale tier is loss-making at NGN pricing** due to image generation volume. See Section 7.

---

## 5. Break-even Analysis (NGN Market)

### Fixed monthly infrastructure floor (in USD)

Without X API: **$307/month** (~₦506,550)
With X API Basic (once enabled): **$407/month** (~₦671,550)

> Use $307 floor until X is enabled for Nigerian users. Do not activate X until NGA MRR comfortably exceeds $1,800/month.

### Minimum paying Nigerian users to break even (no X)

| Tier | Contribution/user | Users needed |
|---|---|---|
| Naira Starter | $7.99 | **39 users** |
| Naira Growth (with 50 image cap) | $17.80 | **18 users** |
| Mixed (50% Starter, 50% Growth) | ~$13 avg | **24 users** |

**Break-even: ~24–39 Nigerian users covers base infrastructure.**

### With X API Basic enabled ($407 floor)

| Tier | Contribution/user | Users needed |
|---|---|---|
| Naira Starter | $7.99 | **51 users** |
| Mixed 50/50 | ~$13 avg | **32 users** |

### Revenue needed to match global tier revenue (founder perspective)

| Global tier | Monthly rev | NGN users needed at Naira Starter |
|---|---|---|
| 10 Starter ($490) | $490 | 55 Naira Starter |
| 10 Growth ($1,490) | $1,490 | 167 Naira Starter |

To match 1 global Growth customer ($149), you need **~7 Nigerian Starter customers**.

---

## 6. Scale Scenarios — Nigerian Market

### Scenario A: Nigeria Beta (50 paying users)

**Mix**: 30 Naira Starter + 15 Naira Growth + 5 Naira Agency
**X status**: Disabled for NGA users at this stage

| | Monthly |
|---|---|
| Revenue | 30×₦14,900 + 15×₦34,900 + 5×₦84,900 = **₦1,394,500** ($845) |
| AI (LLM + images) | $0.04×30 + $2.17×15 + $37.84×5 = **$223** |
| Infra (fixed) | **$307** |
| Paystack fees | ₦325×30 + ₦625×15 + ₦2,000×5 = ₦29,125 (**$18**) |
| X API | **$0** (disabled) |
| **Total COGS** | **$548** |
| **Gross Profit** | **$297** (₦490,050) |
| **Gross Margin** | **35%** |

> Margin is low because the $307 fixed infra floor dominates 50 users. Improves quickly past ~100.

### Scenario B: Nigeria Growth (300 paying users)

**Mix**: 150 Naira Starter + 100 Naira Growth + 40 Naira Agency + 10 Naira Scale*
**X status**: Basic ($100) enabled for Naira Agency+ only — ~20 users, ~600 X posts/month (within 1,500 Basic limit)

*Scale tier with image caps applied — see Section 8

| | Monthly |
|---|---|
| Revenue | 150×₦14,900 + 100×₦34,900 + 40×₦84,900 + 10×₦199,900 = **₦11,180,000** ($6,776) |
| LLM | ~$17 |
| AI images (adjusted caps) | ~$650 |
| Infra | $607 (upgraded) |
| Paystack fees | ~₦110,000 ($67) |
| **X API Basic** | **$100** |
| **Total COGS** | **$1,441** |
| **Gross Profit** | **$5,335** |
| **Gross Margin** | **78.7%** |

### Scenario C: Nigeria at Scale (1,000 paying users)

**Mix**: 500 Naira Starter + 300 Naira Growth + 150 Naira Agency + 50 Naira Scale*
**X status**: Basic ($100) — 200 Agency+Scale users, ~40% have X, ~6,000 X posts/month → still within Basic 1,500 limit if X is gated tightly. Realistically needs Pro at this point.

| | Monthly |
|---|---|
| Revenue | 500×₦14,900 + 300×₦34,900 + 150×₦84,900 + 50×₦199,900 = **₦42,870,000** ($25,982) |
| LLM | ~$57 |
| AI images (adjusted caps) | ~$2,100 |
| Infra | $2,803 |
| Paystack fees | ~₦500,000 ($303) |
| **X API Basic** (gated tightly) | **$100** |
| **Total COGS** | **$5,363** |
| **Gross Profit** | **$20,619** |
| **Gross Margin** | **79.4%** |

> At this scale, X demand will likely exceed Basic limits. Upgrade to Pro ($5,000) **only if X is driving meaningful retention** — it would drop margin to 60.1%. Consider offering X as a ₦8,000/month add-on instead to offset the cost directly.

---

## 7. The Image Cost Problem — and the Fix

AI image generation is charged by Google at **$0.04/image in USD**, regardless of what you charge users in NGN. At ₦1,650/$1, each generated image costs the user ₦66 to serve — but they've paid NGN that's worth much less in USD.

This makes the **Agency and Scale NGN tiers loss-making** at full image usage.

### Solutions (implement in priority order)

**Option A — Cap AI images per NGN tier (recommended)**

Add a `maxAIImagesPerMonth` field to your tier config. NGN tiers get a lower cap than global tiers.

| Tier | Global AI images | NGN AI images |
|---|---|---|
| Naira Growth | Unlimited | 50/month |
| Naira Agency | Unlimited | 200/month |
| Naira Scale | Unlimited | 500/month |

At 200 images/mo cap for Naira Agency: $8 image cost instead of $35 → **margin jumps from 26% → 74%**.

**Option B — Image credits top-up (monetisation opportunity)**

Sell add-on image packs in NGN:
- 50 images: ₦4,900 (~$2.97, covers $2.00 cost at 33% margin)
- 200 images: ₦16,900 (~$10.24, covers $8 cost at 22% margin)
- 500 images: ₦35,900 (~$21.75, covers $20 cost at 8% margin)

**Option C — Use BannerBear templates for NGN tiers**

BannerBear templates cost $0.05/image (at the $99/mo plan) — but look brand-consistent. For Nigerian users who primarily post on Instagram and WhatsApp, template cards perform comparably to AI-generated images. This trades per-image quality for margin.

---

## 8. Revised NGN Tiers (With Image Caps + X API Gating)

After applying image caps (Section 7 Option A) and X API gating:

| Tier | NGN/mo | USD equiv | Posts | AI Images | X Posting | Margin |
|---|---|---|---|---|---|---|
| Sandbox | ₦0 | $0 | 15 | No | No | — |
| Naira Starter | ₦14,900 | $9.03 | 120 | No | No | **88%** |
| Naira Growth | ₦34,900 | $21.15 | 500 | 50/mo | No | **84%** |
| Naira Agency | ₦84,900 | $51.45 | 2,500 | 200/mo | Add-on ₦8,000/mo | **74%** |
| Naira Scale | ₦199,900 | $121.15 | 10,000 | 500/mo | Add-on ₦8,000/mo | **64%** |

**X as a paid add-on (₦8,000/mo ≈ $4.85)**: Naira Agency/Scale users who want X pay an extra ₦8,000/month. This covers ~4 users' share of the X Basic fee, meaning X becomes self-funding at ~21 add-on subscribers. This is far better than absorbing $100/month into base pricing.

All base tier margins are healthy. Scale at 64% is acceptable; image add-on packs provide upsell if needed.

---

## 9. Global vs NGN Pricing Comparison

| Tier | Global (USD) | Global (NGN equiv) | NGN Price | Discount |
|---|---|---|---|---|
| Starter | $49 | ₦80,850 | ₦14,900 | **82% cheaper** |
| Growth | $149 | ₦245,850 | ₦34,900 | **86% cheaper** |
| Agency | $399 | ₦658,350 | ₦84,900 | **87% cheaper** |
| Scale | $999 | ₦1,648,350 | ₦199,900 | **88% cheaper** |

---

## 10. Paystack vs Stripe — Total Fee Comparison at Scale

At 1,000 Nigerian users (₦42.87M MRR):

| | Stripe (if applied to NGN) | Paystack (actual) |
|---|---|---|
| Effective rate | 2.9% | 1.5% capped ₦2,000 |
| Fee on ₦42.87M | ₦1,243,230 ($754) | ~₦500,000 ($303) |
| **Annual saving** | | **~₦5.7M ($3,612)** |

Paystack saves ~60% on transaction fees compared to Stripe for NGN transactions. This is already integrated and working.

---

## 11. NGN Market Revenue Potential

Nigeria's digital marketing sector context:
- **~5 million registered SMBs** in Nigeria (CAC data)
- **~800,000 digital-first businesses** (e-commerce, agencies, online services)
- **~2,000–5,000 social media agencies** operating in Lagos, Abuja, Port Harcourt
- Current tools used: Buffer, Hootsuite, Canva (all USD-priced, creating friction)

Addressable segment for Anthyx Nigeria:
- **TAM**: 50,000 SMBs who actively manage social media and have budget for tools
- **SAM**: ~10,000 who would pay for AI automation (tech-forward businesses)
- **SOM** (realistic 2-year target): 1,000–3,000 customers

At 1,000 Nigerian customers at average ₦28,000/mo ARPU:
- **MRR: ₦28,000,000 (~$16,970)**
- **ARR: ₦336,000,000 (~$203,636)**

At 3,000 customers at ₦28,000 ARPU:
- **MRR: ₦84,000,000 (~$50,909)**
- **ARR: ₦1,008,000,000 (~$611,000)**

---

## 12. Implementation Checklist

These items are needed before launching Nigerian pricing. All Paystack infrastructure is already built.

| Item | Status | Work Required |
|---|---|---|
| Paystack integration | ✅ Done | None |
| `PAYSTACK_PLAN_*` env vars in `.env.example` | ✅ Present | Create NGN plan codes in Paystack dashboard |
| NGN plan codes in DB | ⚠️ Missing | Create plan codes in Paystack dashboard, add to `.env` |
| NGN tiers in `PLAN_TIER_CONFIGS` | ⚠️ Missing | Add `starter_nga`, `growth_nga` etc. OR add `regionPricing` field |
| Image cap per NGN tier | ⚠️ Missing | Add `maxAIImagesPerMonth` to `PlanTierConfig` type, enforce in content worker |
| **X posting blocked for NGA users** | ⚠️ Missing | Add `allowedPlatforms` or `blockedPlatforms` field to NGN tier config; exclude `x` until add-on enabled |
| **X add-on for Naira Agency+** | ⚠️ Missing | Paystack add-on plan at ₦8,000/mo; unlocks X posting when active |
| Currency selector on billing page | ⚠️ Missing | Detect user country (IP geolocation or manual) → show NGN prices |
| Paystack checkout button | ⚠️ Missing | Add alongside Stripe button when `billingRegion === 'NG'` |
| NGN invoice display | ⚠️ Missing | Format amounts in ₦ for Nigerian customers |
| FX rate update job | ⚠️ Optional | Nightly cron to fetch CBN rate → adjust displayed NGN prices |

### Simplest implementation path

The quickest route is to add a `region` field to the `planTiers` DB table (or simply add separate `_nga` tier codes) and detect Nigerian customers by Paystack's country data on signup. No major architectural change needed — Paystack is already wired in.

---

## 13. Key Risks

| Risk | Impact | Mitigation |
|---|---|---|
| **X API Basic rate limit hit** | High | Gate X tightly to Agency+ add-on; monitor tweet count in admin dashboard |
| **X Pro ($5,000) needed before NGA revenue justifies it** | Critical | Do not offer X to NGA users until MRR > $12,000; sell X add-on to fund it |
| Naira devaluation | AI costs rise in NGN terms | Tie prices to CBN rate with a floor; review quarterly |
| Image cost overrun on Agency/Scale | Margin wipes out | Image caps (Section 8) — implement before launch |
| Paystack settlement in NGN → USD conversion loss | Hidden FX cost | Paystack settles to your NGN account; convert via wire or USDC bridge only when needed |
| Price arbitrage (global users signing up via Nigerian pricing) | Revenue leakage | Enforce Paystack-only for NGN tiers + require Nigerian phone number / BVN on Agency+ |
| Low willingness to pay above ₦50K/mo | Sales ceiling | Position Agency/Scale for formal agencies billing clients, not solo operators |
