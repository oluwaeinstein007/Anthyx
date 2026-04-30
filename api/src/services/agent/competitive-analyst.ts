import {
  generateWithFallback,
  extractJsonObject,
  GEMINI_PRO,
  CLAUDE_SONNET,
  GEMINI_FLASH,
  CLAUDE_HAIKU,
} from "./llm-client";
import { parseUrl } from "../brand-ingestion/parser";
import {
  scrapeInstagramProfile,
  scrapeLinkedInCompany,
  type SocialEngagementData,
} from "../social-scraper/apify-client";
import {
  fetchCompetitorMentions,
  type CompetitorMentionData,
} from "../social-scraper/serpapi-client";

// ── Public types ───────────────────────────────────────────────────────────────

export interface CompetitorProfile {
  name: string;
  websiteUrl?: string | null;
  tier: string;
  socialHandles?: Record<string, string> | null;
}

export interface CompetitorLookupResult {
  websiteUrl: string | null;
  socialHandles: Record<string, string>;
  description: string;
  industry: string | null;
}

export interface AnalysisDataBasis {
  engagementBenchmarks: "api" | "llm_inference";
  shareOfVoice: "web_search" | "llm_inference";
  industryOverview: "web_search" | "scraped" | "llm_inference";
  contentAnalysis: "scraped" | "web_search" | "llm_inference";
  sentimentAnalysis: "web_search" | "llm_inference";
}

export interface CompetitiveAnalysisResult {
  industryOverview: {
    summary: string;
    marketSize: string;
    growthRate: string;
    keyTrends: string[];
    majorPlayers: string[];
  };
  contentAnalysis: {
    postingCadence: Record<string, string>;
    topThemes: Record<string, string[]>;
    formatMix: Record<string, { video: number; image: number; text: number; carousel: number }>;
    toneProfiles: Record<string, string>;
  };
  engagementBenchmarks: {
    avgLikes: Record<string, number>;
    avgComments: Record<string, number>;
    avgShares: Record<string, number>;
    engagementRates: Record<string, string>;
    followerGrowthTrend: Record<string, string>;
    viralityScore: Record<string, string>;
  };
  gapAnalysis: {
    uncoveredTopics: string[];
    postingTimeGaps: string[];
    hashtagOpportunities: string[];
    platformGaps: string[];
  };
  shareOfVoice: {
    breakdown: Record<string, number>;
    brandShare: number;
    trend: string;
  };
  sentimentAnalysis: {
    scores: Record<string, { positive: number; neutral: number; negative: number }>;
    topPositiveDrivers: Record<string, string[]>;
    topNegativeDrivers: Record<string, string[]>;
  };
  benchmarkScorecard: {
    metrics: Array<{
      metric: string;
      brandValue: string;
      competitorValues: Record<string, string>;
      status: "ahead" | "at_par" | "behind";
    }>;
  };
  dataBasis: AnalysisDataBasis;
}

// ── Data-gathering helpers ─────────────────────────────────────────────────────

async function scrapeMultiplePages(websiteUrl: string): Promise<string> {
  const base = new URL(
    /^https?:\/\//i.test(websiteUrl) ? websiteUrl : `https://${websiteUrl}`,
  ).origin;

  const paths = ["/", "/about", "/blog", "/pricing"];

  const results = await Promise.allSettled(
    paths.map(async (path): Promise<string | null> => {
      try {
        const parsed = await parseUrl(`${base}${path}`);
        return `[${path}]\n${parsed.text.slice(0, 2000)}`;
      } catch {
        return null;
      }
    }),
  );

  return results
    .map((r) => (r.status === "fulfilled" && r.value ? r.value : null))
    .filter(Boolean)
    .join("\n\n---\n\n");
}

async function searchTavilyForCompetitor(name: string, industry: string): Promise<string> {
  const apiKey = process.env["SEARCH_API_KEY"];
  if (!apiKey) return "";

  const queries = [
    `${name} marketing campaign content strategy`,
    `${name} product launch announcement ${new Date().getFullYear()}`,
    `${name} ${industry} positioning`,
  ];

  const results = await Promise.allSettled(
    queries.map(async (query): Promise<string> => {
      try {
        const res = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ api_key: apiKey, query, search_depth: "basic", max_results: 3 }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) return "";
        const data = (await res.json()) as {
          results: Array<{ title: string; snippet: string }>;
        };
        return data.results.map((r) => `${r.title}: ${r.snippet}`).join("\n");
      } catch {
        return "";
      }
    }),
  );

  return results
    .map((r) => (r.status === "fulfilled" ? r.value : ""))
    .filter(Boolean)
    .join("\n\n");
}

// ── Per-competitor data pipeline ───────────────────────────────────────────────

interface CompetitorGatheredData {
  profile: CompetitorProfile;
  scrapedContent: string;
  tavilyContext: string;
  socialData: SocialEngagementData | null;
  mentionData: CompetitorMentionData | null;
}

async function gatherCompetitorData(
  profile: CompetitorProfile,
  industry: string,
): Promise<CompetitorGatheredData> {
  const handles = (profile.socialHandles ?? {}) as Record<string, string>;

  const [scrapedContent, tavilyContext, socialData, mentionData] = await Promise.all([
    profile.websiteUrl
      ? scrapeMultiplePages(profile.websiteUrl).catch(() => "")
      : Promise.resolve(""),

    searchTavilyForCompetitor(profile.name, industry),

    (async (): Promise<SocialEngagementData | null> => {
      if (handles["instagram"]) {
        const ig = await scrapeInstagramProfile(handles["instagram"]);
        if (ig) return ig;
      }
      if (handles["linkedin"]) {
        return scrapeLinkedInCompany(handles["linkedin"]);
      }
      return null;
    })(),

    fetchCompetitorMentions(profile.name),
  ]);

  return { profile, scrapedContent, tavilyContext, socialData, mentionData };
}

interface PerCompetitorFacts {
  name: string;
  contentThemes: string[];
  tone: string;
  recentCampaigns: string[];
  postingCadence: string;
  platformPresence: string[];
  differentiators: string[];
}

async function extractPerCompetitorFacts(
  data: CompetitorGatheredData,
): Promise<PerCompetitorFacts> {
  const contextParts: string[] = [];
  if (data.scrapedContent)
    contextParts.push(`Website content:\n${data.scrapedContent.slice(0, 4000)}`);
  if (data.tavilyContext)
    contextParts.push(`Recent web intelligence:\n${data.tavilyContext.slice(0, 2000)}`);
  if (data.mentionData?.recentHeadlines.length)
    contextParts.push(`Recent news: ${data.mentionData.recentHeadlines.join(" | ")}`);
  if (data.socialData)
    contextParts.push(
      `Social data (${data.socialData.platform}): followers=${data.socialData.followersCount}, ` +
        `avgLikes=${data.socialData.avgLikesPerPost}, engRate=${data.socialData.engagementRate}%, ` +
        `postFrequency=${data.socialData.postingFrequency}`,
    );

  const context =
    contextParts.length > 0
      ? contextParts.join("\n\n")
      : "No external data available — use general knowledge about this brand.";

  const raw = await generateWithFallback({
    systemPrompt:
      "You are a competitive intelligence analyst. Return ONLY valid JSON — no prose, no markdown.",
    userMessage: `Extract structured facts about competitor "${data.profile.name}" from the context below.

${context}

Return JSON:
{
  "contentThemes": ["theme1", "theme2", "theme3"],
  "tone": "1-sentence tone description",
  "recentCampaigns": ["recent campaign if found, else empty array"],
  "postingCadence": "e.g. '3-5 posts/week on Instagram'",
  "platformPresence": ["instagram", "linkedin"],
  "differentiators": ["unique point 1", "unique point 2"]
}`,
    geminiModel: GEMINI_FLASH,
    claudeModel: CLAUDE_HAIKU,
    maxTokens: 512,
  });

  try {
    const parsed = extractJsonObject(raw) as Partial<PerCompetitorFacts>;
    return {
      name: data.profile.name,
      contentThemes: parsed.contentThemes ?? [],
      tone: parsed.tone ?? "unknown",
      recentCampaigns: parsed.recentCampaigns ?? [],
      postingCadence:
        data.socialData?.postingFrequency && data.socialData.postingFrequency !== "unknown"
          ? data.socialData.postingFrequency
          : (parsed.postingCadence ?? "unknown"),
      platformPresence: parsed.platformPresence ?? [],
      differentiators: parsed.differentiators ?? [],
    };
  } catch {
    return {
      name: data.profile.name,
      contentThemes: [],
      tone: "unknown",
      recentCampaigns: [],
      postingCadence: "unknown",
      platformPresence: [],
      differentiators: [],
    };
  }
}

// ── Real-data builders ─────────────────────────────────────────────────────────

function buildEngagementBenchmarks(
  gathered: CompetitorGatheredData[],
): { benchmarks: CompetitiveAnalysisResult["engagementBenchmarks"]; hasApiData: boolean } {
  const avgLikes: Record<string, number> = {};
  const avgComments: Record<string, number> = {};
  const avgShares: Record<string, number> = {};
  const engagementRates: Record<string, string> = {};
  const followerGrowthTrend: Record<string, string> = {};
  const viralityScore: Record<string, string> = {};
  let hasApiData = false;

  for (const d of gathered) {
    if (!d.socialData) continue;
    hasApiData = true;
    followerGrowthTrend[d.profile.name] = d.socialData.followerGrowthTrend ?? "data unavailable";
    viralityScore[d.profile.name] = "requires extended monitoring";
    // LinkedIn API doesn't expose post-level engagement; skip those fields to avoid
    // overwriting LLM estimates with misleading zeros.
    if (d.socialData.platform === "instagram") {
      avgLikes[d.profile.name] = d.socialData.avgLikesPerPost;
      avgComments[d.profile.name] = d.socialData.avgCommentsPerPost;
      avgShares[d.profile.name] = 0;
      engagementRates[d.profile.name] = `${d.socialData.engagementRate}%`;
    }
  }

  return {
    benchmarks: { avgLikes, avgComments, avgShares, engagementRates, followerGrowthTrend, viralityScore },
    hasApiData,
  };
}

function buildShareOfVoice(
  gathered: CompetitorGatheredData[],
  brandName: string,
): {
  shareOfVoice: CompetitiveAnalysisResult["shareOfVoice"] | null;
  hasWebData: boolean;
} {
  const hasMentionData = gathered.some((d) => d.mentionData !== null);
  if (!hasMentionData) return { shareOfVoice: null, hasWebData: false };

  const counts: Record<string, number> = {};
  for (const d of gathered) {
    counts[d.profile.name] = d.mentionData?.recentMentionCount ?? 0;
  }

  const total = Object.values(counts).reduce((s, v) => s + v, 0);
  if (total === 0) return { shareOfVoice: null, hasWebData: false };

  // Compute exact fractions then round at the end to avoid rounding accumulation
  // exceeding 100% and clamping the brand to 0%.
  const entries = Object.entries(counts);
  const exactShares = entries.map(([name, count]) => ({ name, share: (count / total) * 100 }));
  const breakdown: Record<string, number> = {};
  for (const { name, share } of exactShares) {
    breakdown[name] = Math.round(share);
  }
  const competitorTotal = Object.values(breakdown).reduce((s, v) => s + v, 0);
  breakdown[brandName] = Math.max(0, 100 - competitorTotal);

  return {
    shareOfVoice: {
      breakdown,
      brandShare: breakdown[brandName] ?? 0,
      trend: "Based on recent news mention volume (SerpApi)",
    },
    hasWebData: true,
  };
}

// ── LLM synthesis ──────────────────────────────────────────────────────────────

type LLMSynthesisOutput = Omit<
  CompetitiveAnalysisResult,
  "dataBasis" | "benchmarkScorecard"
>;

async function synthesizeAnalysis(
  brandName: string,
  industry: string,
  facts: PerCompetitorFacts[],
  gathered: CompetitorGatheredData[],
): Promise<LLMSynthesisOutput> {
  const factsContext = facts
    .map((f) => {
      const d = gathered.find((g) => g.profile.name === f.name);
      return `### ${f.name} (${d?.profile.tier ?? "direct"})
Themes: ${f.contentThemes.join(", ") || "—"}
Tone: ${f.tone}
Posting: ${f.postingCadence}
Platforms: ${f.platformPresence.join(", ") || "—"}
Differentiators: ${f.differentiators.join("; ") || "—"}
Recent campaigns: ${f.recentCampaigns.join("; ") || "none identified"}${
  d?.mentionData?.recentHeadlines.length
    ? `\nRecent headlines: ${d.mentionData.recentHeadlines.slice(0, 3).join(" | ")}`
    : ""
}`;
    })
    .join("\n\n");

  const competitorNames = facts.map((f) => f.name);

  const raw = await generateWithFallback({
    systemPrompt:
      "You are a competitive intelligence analyst. Return ONLY valid JSON — no prose, no markdown fences.",
    userMessage: `Perform a cross-competitor analysis for brand "${brandName}" in the "${industry}" industry.

COMPETITOR FACT SHEETS (grounded in real scraped and search data):
${factsContext}

Return a JSON object with EXACTLY these sections. Replace "CompetitorName" with actual names from: ${competitorNames.join(", ")}.

{
  "industryOverview": {
    "summary": "2-3 sentences",
    "marketSize": "estimated market size",
    "growthRate": "estimated annual growth rate",
    "keyTrends": ["trend1", "trend2", "trend3", "trend4"],
    "majorPlayers": ["player1", "player2", "player3"]
  },
  "contentAnalysis": {
    "postingCadence": { "CompetitorName": "3-5 posts/week on Instagram" },
    "topThemes": { "CompetitorName": ["theme1", "theme2", "theme3"] },
    "formatMix": { "CompetitorName": { "video": 40, "image": 35, "text": 15, "carousel": 10 } },
    "toneProfiles": { "CompetitorName": "professional and educational" }
  },
  "engagementBenchmarks": {
    "avgLikes": { "CompetitorName": 320 },
    "avgComments": { "CompetitorName": 45 },
    "avgShares": { "CompetitorName": 28 },
    "engagementRates": { "CompetitorName": "2.4%" },
    "followerGrowthTrend": { "CompetitorName": "+1.2% per month" },
    "viralityScore": { "CompetitorName": "12% of posts exceed 3x avg" }
  },
  "gapAnalysis": {
    "uncoveredTopics": ["topic1", "topic2", "topic3"],
    "postingTimeGaps": ["Tuesdays 6–8am", "Sundays all day"],
    "hashtagOpportunities": ["#hashtag1", "#hashtag2"],
    "platformGaps": ["Pinterest", "Threads"]
  },
  "shareOfVoice": {
    "breakdown": { "CompetitorName": 35, "${brandName}": 20 },
    "brandShare": 20,
    "trend": "..."
  },
  "sentimentAnalysis": {
    "scores": { "CompetitorName": { "positive": 62, "neutral": 28, "negative": 10 } },
    "topPositiveDrivers": { "CompetitorName": ["product quality", "support"] },
    "topNegativeDrivers": { "CompetitorName": ["pricing", "slow updates"] }
  }
}`,
    geminiModel: GEMINI_PRO,
    claudeModel: CLAUDE_SONNET,
    maxTokens: 3500,
  });

  return extractJsonObject(raw) as LLMSynthesisOutput;
}

async function generateBenchmarkScorecard(
  brandName: string,
  facts: PerCompetitorFacts[],
  engagementBenchmarks: CompetitiveAnalysisResult["engagementBenchmarks"],
): Promise<CompetitiveAnalysisResult["benchmarkScorecard"]> {
  const engContext = Object.entries(engagementBenchmarks.engagementRates)
    .map(([name, rate]) => `${name}: ${rate}`)
    .join(", ");

  const raw = await generateWithFallback({
    systemPrompt: "Return ONLY valid JSON.",
    userMessage: `Generate a benchmark scorecard comparing "${brandName}" against its competitors.

Engagement rates (real data where available): ${engContext || "not available"}
Competitors: ${facts.map((f) => `${f.name} — cadence: ${f.postingCadence}, tone: ${f.tone}`).join("; ")}

Return JSON:
{
  "metrics": [
    {
      "metric": "Avg Engagement Rate",
      "brandValue": "estimate based on industry average",
      "competitorValues": { "CompetitorName": "2.4%" },
      "status": "behind"
    },
    {
      "metric": "Posting Frequency",
      "brandValue": "4/week",
      "competitorValues": { "CompetitorName": "3/week" },
      "status": "ahead"
    },
    {
      "metric": "Content Diversity",
      "brandValue": "5 content types",
      "competitorValues": { "CompetitorName": "3 content types" },
      "status": "ahead"
    },
    {
      "metric": "Platform Reach",
      "brandValue": "3 platforms",
      "competitorValues": { "CompetitorName": "4 platforms" },
      "status": "behind"
    }
  ]
}`,
    geminiModel: GEMINI_FLASH,
    claudeModel: CLAUDE_HAIKU,
    maxTokens: 1024,
  });

  try {
    return extractJsonObject(raw) as CompetitiveAnalysisResult["benchmarkScorecard"];
  } catch {
    return { metrics: [] };
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

export async function lookupCompetitorInfo(
  name: string,
  websiteUrl?: string | null,
  scrapedContent?: string,
): Promise<CompetitorLookupResult> {
  const contextLines: string[] = [];
  if (websiteUrl) contextLines.push(`Known website: ${websiteUrl}`);
  if (scrapedContent)
    contextLines.push(`Website content snippet:\n${scrapedContent.slice(0, 2000)}`);

  const prompt = `You are a brand research assistant. Given a competitor brand name, return basic public information about them.

Brand name: "${name}"
${contextLines.join("\n")}

Return ONLY valid JSON with this exact structure:
{
  "websiteUrl": "https://example.com or null if unknown",
  "socialHandles": {
    "twitter": "@handle or null",
    "instagram": "@handle or null",
    "linkedin": "company-slug or null",
    "tiktok": "@handle or null"
  },
  "description": "1-2 sentence description of what this company does",
  "industry": "industry/vertical or null"
}

Rules:
- Only include social handles you are confident about
- websiteUrl must be a real URL or null
- Base answers on the scraped content if provided, otherwise use your knowledge`;

  const raw = await generateWithFallback({
    systemPrompt:
      "You are a brand research assistant. Return ONLY valid JSON — no prose, no markdown fences.",
    userMessage: prompt,
    geminiModel: GEMINI_FLASH,
    claudeModel: CLAUDE_HAIKU,
    maxTokens: 512,
  });

  const parsed = extractJsonObject(raw) as CompetitorLookupResult;
  if (parsed.socialHandles) {
    for (const key of Object.keys(parsed.socialHandles)) {
      if (!parsed.socialHandles[key] || parsed.socialHandles[key] === "null") {
        delete parsed.socialHandles[key];
      }
    }
  }
  return parsed;
}

export async function suggestCompetitors(
  brandName: string,
  industry: string,
  positioning: string | null,
  existingNames: string[],
): Promise<string[]> {
  // Ground suggestions with a live web search
  let webContext = "";
  const apiKey = process.env["SEARCH_API_KEY"];
  if (apiKey) {
    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          query: `top ${industry} companies competitors alternatives ${new Date().getFullYear()}`,
          search_depth: "basic",
          max_results: 5,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          results: Array<{ title: string; snippet: string }>;
        };
        webContext = data.results.map((r) => `${r.title}: ${r.snippet}`).join("\n");
      }
    } catch {
      // fall through to LLM-only
    }
  }

  const prompt = `You are a competitive intelligence researcher.

Brand: "${brandName}"
Industry: "${industry}"
${positioning ? `Positioning: "${positioning}"` : ""}
${existingNames.length > 0 ? `Already tracking (exclude these): ${existingNames.join(", ")}` : ""}
${webContext ? `\nCurrent web intelligence about this industry:\n${webContext}\n` : ""}

List the 6–8 most relevant direct competitors for this brand.
Return ONLY a JSON array of company name strings, ordered by relevance.

Rules:
- Only real, known companies
- Direct competitors in the same market segment
- Do NOT include the brand itself
- Do NOT repeat names from the "Already tracking" list`;

  const raw = await generateWithFallback({
    systemPrompt:
      "You are a competitive intelligence researcher. Return ONLY a valid JSON array of strings — no prose, no markdown.",
    userMessage: prompt,
    geminiModel: GEMINI_FLASH,
    claudeModel: CLAUDE_HAIKU,
    maxTokens: 256,
  });

  const match = raw.trim().match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]) as unknown[];
    return parsed
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .map((s) => s.trim())
      .filter((n) => !existingNames.some((e) => e.toLowerCase() === n.toLowerCase()))
      .slice(0, 8);
  } catch {
    return [];
  }
}

export async function generateCompetitiveAnalysis(
  brandName: string,
  industry: string,
  competitorProfiles: CompetitorProfile[],
): Promise<CompetitiveAnalysisResult> {
  // Step 1: Gather all external data in parallel per competitor
  const gathered = await Promise.all(
    competitorProfiles.map((p) => gatherCompetitorData(p, industry)),
  );

  // Step 2: Extract per-competitor facts with small parallel LLM calls
  const facts = await Promise.all(gathered.map(extractPerCompetitorFacts));

  // Step 3: Build real engagement benchmarks from Apify data (no LLM)
  const { benchmarks: apiBenchmarks, hasApiData } = buildEngagementBenchmarks(gathered);

  // Step 4: Build share-of-voice from SerpApi mention counts (no LLM)
  const { shareOfVoice: apiShareOfVoice, hasWebData: hasSovData } = buildShareOfVoice(
    gathered,
    brandName,
  );

  // Step 5: LLM synthesis — grounded by real fact sheets
  const synthesis = await synthesizeAnalysis(brandName, industry, facts, gathered);

  // Step 6: LLM benchmark scorecard
  const engagementForScorecard = hasApiData ? apiBenchmarks : synthesis.engagementBenchmarks;
  const benchmarkScorecard = await generateBenchmarkScorecard(
    brandName,
    facts,
    engagementForScorecard,
  );

  // Real API data overrides LLM-generated sections where available
  const engagementBenchmarks = hasApiData
    ? {
        ...synthesis.engagementBenchmarks,
        avgLikes: { ...synthesis.engagementBenchmarks.avgLikes, ...apiBenchmarks.avgLikes },
        avgComments: {
          ...synthesis.engagementBenchmarks.avgComments,
          ...apiBenchmarks.avgComments,
        },
        engagementRates: {
          ...synthesis.engagementBenchmarks.engagementRates,
          ...apiBenchmarks.engagementRates,
        },
        followerGrowthTrend: {
          ...synthesis.engagementBenchmarks.followerGrowthTrend,
          ...apiBenchmarks.followerGrowthTrend,
        },
      }
    : synthesis.engagementBenchmarks;

  const shareOfVoice = apiShareOfVoice ?? synthesis.shareOfVoice;

  // Step 7: Determine data basis for UI labels
  const hasTavilyData = gathered.some((d) => d.tavilyContext.length > 0);
  const hasScrapedData = gathered.some((d) => d.scrapedContent.length > 0);

  const dataBasis: AnalysisDataBasis = {
    engagementBenchmarks: hasApiData ? "api" : "llm_inference",
    shareOfVoice: hasSovData ? "web_search" : "llm_inference",
    industryOverview: hasTavilyData ? "web_search" : hasScrapedData ? "scraped" : "llm_inference",
    contentAnalysis: hasScrapedData ? "scraped" : hasTavilyData ? "web_search" : "llm_inference",
    sentimentAnalysis: hasSovData ? "web_search" : "llm_inference",
  };

  return {
    industryOverview: synthesis.industryOverview,
    contentAnalysis: synthesis.contentAnalysis,
    engagementBenchmarks,
    gapAnalysis: synthesis.gapAnalysis,
    shareOfVoice,
    sentimentAnalysis: synthesis.sentimentAnalysis,
    benchmarkScorecard,
    dataBasis,
  };
}
