import { generateWithFallback, extractJsonObject, GEMINI_PRO, CLAUDE_SONNET } from "./llm-client";

export interface CompetitorProfile {
  name: string;
  websiteUrl?: string | null;
  tier: string;
  socialHandles?: Record<string, string> | null;
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

export async function generateCompetitiveAnalysis(
  brandName: string,
  industry: string,
  competitorProfiles: CompetitorProfile[],
): Promise<CompetitiveAnalysisResult> {
  const competitorList = competitorProfiles
    .map((c) => `- ${c.name} (${c.tier}${c.websiteUrl ? `, ${c.websiteUrl}` : ""})`)
    .join("\n");

  const prompt = `You are a competitive intelligence analyst. Generate a comprehensive competitive analysis for the brand "${brandName}" in the "${industry}" industry.

Competitors being analyzed:
${competitorList}

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
