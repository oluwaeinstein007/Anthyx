import { generateWithFallback, extractJsonObject, GEMINI_PRO, CLAUDE_SONNET, GEMINI_FLASH, CLAUDE_HAIKU } from "./llm-client";
import { parseUrl } from "../brand-ingestion/parser";

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

export async function lookupCompetitorInfo(
  name: string,
  websiteUrl?: string | null,
  scrapedContent?: string,
): Promise<CompetitorLookupResult> {
  const contextLines: string[] = [];
  if (websiteUrl) contextLines.push(`Known website: ${websiteUrl}`);
  if (scrapedContent) contextLines.push(`Website content snippet:\n${scrapedContent.slice(0, 2000)}`);

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
- Only include social handles you are confident about (omit keys where you are unsure)
- websiteUrl must be a real URL or null
- socialHandles may be an empty object if unknown
- Base answers on the scraped content if provided, otherwise use your knowledge`;

  const raw = await generateWithFallback({
    systemPrompt: "You are a brand research assistant. Return ONLY valid JSON — no prose, no markdown fences.",
    userMessage: prompt,
    geminiModel: GEMINI_FLASH,
    claudeModel: CLAUDE_HAIKU,
    maxTokens: 512,
  });

  const parsed = extractJsonObject(raw) as CompetitorLookupResult;
  // Strip null social handle values
  if (parsed.socialHandles) {
    for (const key of Object.keys(parsed.socialHandles)) {
      if (!parsed.socialHandles[key] || parsed.socialHandles[key] === "null") {
        delete parsed.socialHandles[key];
      }
    }
  }
  return parsed;
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
    postingCadence: Record<string, string>; // competitor → "X posts/week on platform"
    topThemes: Record<string, string[]>;    // competitor → themes
    formatMix: Record<string, { video: number; image: number; text: number; carousel: number }>;
    toneProfiles: Record<string, string>;  // competitor → tone description
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
    breakdown: Record<string, number>; // competitor → share percentage (0-100)
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
}

export async function suggestCompetitors(
  brandName: string,
  industry: string,
  positioning: string | null,
  existingNames: string[],
): Promise<string[]> {
  const prompt = `You are a competitive intelligence researcher.

Brand: "${brandName}"
Industry: "${industry}"
${positioning ? `Positioning: "${positioning}"` : ""}
${existingNames.length > 0 ? `Already tracking (exclude these): ${existingNames.join(", ")}` : ""}

List the 6–8 most relevant direct competitors for this brand based on its industry and positioning.
Return ONLY a JSON array of company name strings, ordered by relevance. Example:
["Company A", "Company B", "Company C"]

Rules:
- Only real, known companies
- Direct competitors operating in the same market segment
- Do NOT include the brand itself
- Do NOT repeat any names from the "Already tracking" list`;

  const raw = await generateWithFallback({
    systemPrompt: "You are a competitive intelligence researcher. Return ONLY a valid JSON array of strings — no prose, no markdown.",
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
      .filter((name) => !existingNames.some((e) => e.toLowerCase() === name.toLowerCase()))
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
  // Scrape competitor websites in parallel to ground the analysis in real content
  const scrapedData = await Promise.allSettled(
    competitorProfiles.map(async (c) => {
      if (!c.websiteUrl) return { name: c.name, content: null };
      try {
        const parsed = await parseUrl(c.websiteUrl);
        return { name: c.name, content: parsed.text.slice(0, 3000) };
      } catch {
        return { name: c.name, content: null };
      }
    }),
  );

  const competitorContext = scrapedData
    .map((r) => {
      if (r.status !== "fulfilled" || !r.value.content) return null;
      return `### ${r.value.name} (website content)\n${r.value.content}`;
    })
    .filter(Boolean)
    .join("\n\n");

  const competitorList = competitorProfiles
    .map((c) => `- ${c.name} (${c.tier}${c.websiteUrl ? `, ${c.websiteUrl}` : ""})`)
    .join("\n");

  const prompt = `You are a competitive intelligence analyst. Generate a comprehensive competitive analysis for the brand "${brandName}" in the "${industry}" industry.

Competitors being analyzed:
${competitorList}
${competitorContext ? `\nReal website content scraped from competitor sites (use this to make the analysis accurate and specific):\n${competitorContext}\n` : ""}

Return a single JSON object with EXACTLY this structure (no extra keys, no prose outside the JSON):

{
  "industryOverview": {
    "summary": "2-3 sentence industry overview",
    "marketSize": "estimated market size",
    "growthRate": "estimated annual growth rate",
    "keyTrends": ["trend1", "trend2", "trend3", "trend4"],
    "majorPlayers": ["player1", "player2", "player3"]
  },
  "contentAnalysis": {
    "postingCadence": {
      "CompetitorName": "3-5 posts/week across Instagram and LinkedIn"
    },
    "topThemes": {
      "CompetitorName": ["theme1", "theme2", "theme3"]
    },
    "formatMix": {
      "CompetitorName": { "video": 40, "image": 35, "text": 15, "carousel": 10 }
    },
    "toneProfiles": {
      "CompetitorName": "professional and educational with occasional humour"
    }
  },
  "engagementBenchmarks": {
    "avgLikes": { "CompetitorName": 320 },
    "avgComments": { "CompetitorName": 45 },
    "avgShares": { "CompetitorName": 28 },
    "engagementRates": { "CompetitorName": "2.4%" },
    "followerGrowthTrend": { "CompetitorName": "+1.2% per month over 90 days" },
    "viralityScore": { "CompetitorName": "12% of posts exceed 3× average engagement" }
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
    "trend": "Brand gained 3 points over the past 90 days"
  },
  "sentimentAnalysis": {
    "scores": {
      "CompetitorName": { "positive": 62, "neutral": 28, "negative": 10 }
    },
    "topPositiveDrivers": {
      "CompetitorName": ["product quality", "customer support"]
    },
    "topNegativeDrivers": {
      "CompetitorName": ["pricing concerns", "slow updates"]
    }
  },
  "benchmarkScorecard": {
    "metrics": [
      {
        "metric": "Avg Engagement Rate",
        "brandValue": "1.8%",
        "competitorValues": { "CompetitorName": "2.4%" },
        "status": "behind"
      },
      {
        "metric": "Posting Frequency",
        "brandValue": "5/week",
        "competitorValues": { "CompetitorName": "4/week" },
        "status": "ahead"
      }
    ]
  }
}

Replace "CompetitorName" with actual competitor names from the list above. Include ALL competitors in each section. For "${brandName}", use plausible estimates consistent with being a newer or growing brand.`;

  const raw = await generateWithFallback({
    systemPrompt: "You are a competitive intelligence analyst. Return ONLY valid JSON — no prose, no markdown fences.",
    userMessage: prompt,
    geminiModel: GEMINI_PRO,
    claudeModel: CLAUDE_SONNET,
    maxTokens: 4096,
  });

  return extractJsonObject(raw) as CompetitiveAnalysisResult;
}
