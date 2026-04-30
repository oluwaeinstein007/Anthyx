# Competitive Intelligence — Accuracy Improvements

## Root Problem

`generateCompetitiveAnalysis` in `api/src/services/agent/competitive-analyst.ts` scrapes only
the competitor homepage (3000 chars max), then asks an LLM to generate engagement metrics,
share of voice, sentiment scores, and follower growth with no real data behind them. Every
number in `engagementBenchmarks` and `shareOfVoice` is hallucinated. This is the core
accuracy problem — presenting invented numbers as fact is worse than showing no data because
users make real decisions on it.

---

## Recommendations (Priority Order)

### 1. Integrate Real Social Data API for Engagement Numbers

**Decision: Apify (Instagram/LinkedIn) + SerpApi social search.**

Replace the hallucinated `engagementBenchmarks` section with data pulled from real APIs
before the LLM prompt is built.

**Implementation plan:**

- Add an `api/src/services/social-scraper/` module with two clients:
  - `apify-client.ts` — Apify Actor calls for Instagram profile stats and LinkedIn company pages
    (followers, avg likes/comments on recent posts, posting frequency)
  - `serpapi-client.ts` — SerpApi `google_news` + social search for share-of-voice proxy
    (mention volume, sentiment from headlines)
- Before calling `generateCompetitiveAnalysis`, run the social scraper per competitor in
  parallel and pass structured JSON results into the prompt as **grounded context**
- The LLM then synthesises and formats; it no longer invents the numbers

**Apify actors to use:**
- `apify/instagram-profile-scraper` — followers, avg engagement rate, post frequency
- `apify/linkedin-company-scraper` — follower count, post frequency, engagement signals

**SerpApi endpoints:**
- `GET /search?engine=google&q=site:instagram.com+CompetitorName` — content volume proxy
- `GET /search?engine=google_news&q=CompetitorName+marketing` — recent mention volume for
  share-of-voice estimation

**Env vars to add:**
```
APIFY_API_TOKEN=
SERPAPI_KEY=
```

**Fields that become real data** (currently fabricated):
- `engagementBenchmarks.avgLikes`
- `engagementBenchmarks.avgComments`
- `engagementBenchmarks.engagementRates`
- `engagementBenchmarks.followerGrowthTrend`
- `engagementBenchmarks.viralityScore`
- `shareOfVoice.breakdown`

**Fields that remain LLM-synthesised** (acceptable — qualitative):
- `contentAnalysis.toneProfiles`
- `gapAnalysis`
- `sentimentAnalysis` (unless SerpApi news sentiment is added)
- `benchmarkScorecard.status` judgements

---

### 2. Add Tavily Web Search Per Competitor Before Analysis

The Strategist already uses Tavily (`services/agent/src/tools/web-search-trends.ts`) but
`generateCompetitiveAnalysis` does not call it. Add a **Phase 1 research pass** that runs
3 Tavily searches per competitor before the main analysis prompt:

```
"{CompetitorName} marketing campaign 2026"
"{CompetitorName} content strategy social media"
"{CompetitorName} product launch announcement"
```

Pass the returned snippets as grounded context. This directly improves:
- `industryOverview.keyTrends` (real recent events, not stale training data)
- `contentAnalysis.topThemes` (actual campaign topics)
- `gapAnalysis.uncoveredTopics` (what competitors are NOT talking about)

Reuse `SEARCH_API_KEY` (already used by the strategist) — no new env var needed.

---

### 3. Scrape Multiple Pages Per Competitor

Current code scrapes only the homepage. A homepage is mostly hero copy and navigation — the
least useful page for competitive analysis. Change `generateCompetitiveAnalysis` to scrape:

| Page | What it reveals |
|------|----------------|
| `/blog` or `/blog/` | Real content pillars, posting frequency, editorial voice |
| `/about` | Positioning, mission, differentiators |
| `/pricing` | Tier structure, target segment, value props |

Use `Promise.allSettled` (already used for homepage scraping) so any failed page falls through
silently. Cap each page at 2000 chars. Total context per competitor becomes ~6000 chars
instead of 3000.

---

### 4. Split the Single Giant Prompt into a Multi-Step Pipeline

The current single 4096-token call must fill 7 sections in one shot. When the model has no
data for a section it fills in plausible-sounding values. Split into three sequential calls:

**Step 1 — Per-competitor fact extraction** (1 call per competitor, small/fast model)
- Input: scraped pages + Tavily snippets for one competitor
- Output: structured raw facts (content themes, recent campaigns, platform presence)

**Step 2 — Cross-competitor synthesis** (1 call, Sonnet/Pro)
- Input: all per-competitor fact sheets
- Output: `contentAnalysis`, `gapAnalysis`, `industryOverview`

**Step 3 — Scorecard and benchmarks** (1 call, Haiku/Flash)
- Input: synthesis output + real API engagement data from recommendation #1
- Output: `benchmarkScorecard`, `engagementBenchmarks`, `shareOfVoice`

This prevents hallucination-to-fill-template and allows using cheaper models for early steps.

---

### 5. Add `dataBasis` Annotation Per Section

Add a field to each top-level section of `CompetitiveAnalysisResult`:

```typescript
dataBasis: "api" | "scraped" | "web_search" | "llm_inference"
```

Render a small label in the UI next to each card so users know what is grounded vs. estimated.
This is a trust calibration feature — it doesn't reduce hallucination but prevents users from
treating all outputs with equal confidence.

Priority for labelling:
- `engagementBenchmarks` → `"api"` once Apify is integrated
- `industryOverview` → `"web_search"` once Tavily is wired in
- `contentAnalysis` → `"scraped"` where derived from page content
- `sentimentAnalysis` → `"llm_inference"` until a reviews/news source is added

---

### 6. Surface Staleness in the UI

`competitorAnalyses.generatedAt` exists in the DB but is not surfaced in the frontend.
Competitive intel goes stale fast. Add:
- A "Last updated X days ago" label on the competitive intelligence page
- A warning banner when analysis is older than 7 days
- Auto-suggest refresh when the user navigates to the page and analysis is stale

No backend changes needed — `generatedAt` is already returned in the GET response.

---

### 7. Ground `suggestCompetitors` with a Web Search

`suggestCompetitors` relies entirely on LLM training data, which may be years old and biased
toward well-known companies. Augment it with a Tavily search:

```
"[industry] top competitors alternatives to [brandName]"
"best [industry] tools [year]"
```

Use search results to seed the competitor list before the LLM ranks them. This is especially
important for niche industries where the model has weak training signal.

---

## Implementation Order

| # | Change | Effort | Accuracy Impact |
|---|--------|--------|----------------|
| 1 | Apify + SerpApi for real engagement data | High | Critical — eliminates hallucinated numbers |
| 2 | Tavily search per competitor | Low | High — grounds industry and content analysis |
| 3 | Scrape /blog, /about, /pricing | Low | Medium — richer content analysis |
| 4 | Multi-step prompt pipeline | Medium | Medium — reduces fill-in-the-blank hallucination |
| 5 | `dataBasis` annotations | Low | Trust — not accuracy, but user confidence |
| 6 | Staleness UI warning | Very low | UX — prevents stale data being treated as current |
| 7 | Ground suggestCompetitors with search | Low | Medium — better competitor discovery |

## Files to Touch

- `api/src/services/agent/competitive-analyst.ts` — core analysis function
- `api/src/services/social-scraper/apify-client.ts` — new file
- `api/src/services/social-scraper/serpapi-client.ts` — new file
- `api/src/routes/competitive.ts` — wire social scraper into refresh route
- `frontend/src/app/(dashboard)/dashboard/brands/[id]/competitive/page.tsx` — staleness UI
- `.env.example` — add `APIFY_API_TOKEN`, `SERPAPI_KEY`
