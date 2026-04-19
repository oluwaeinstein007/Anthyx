import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { FunctionDeclaration, Tool } from "@google/generative-ai";
import { PlanItemArraySchema } from "@anthyx/config";
import type { GeneratedPlanItem } from "@anthyx/types";
import { buildSystemPromptWithGuardrails } from "./guardrails.js";
import { retrieveBrandVoiceFromQdrant } from "./brand-context.js";
import { db } from "./db.js";
import { brandProfiles } from "./schema.js";
import { eq } from "drizzle-orm";

import { webSearchTrends } from "./tools/web-search-trends.js";
import { readEngagementAnalytics } from "./tools/read-engagement-analytics.js";

const genAI = new GoogleGenerativeAI(process.env["GEMINI_API_KEY"] ?? "");
const MODEL = process.env["GEMINI_STRATEGIST_MODEL"] ?? "gemini-1.5-pro";

const STRATEGIST_BASE = `You are a senior digital marketing strategist.
You generate data-driven, brand-aligned 30-day marketing calendars.
You have access to tools to retrieve brand context, search for industry trends,
and read past engagement performance.

Rules:
- Every plan item must map to a content pillar: educational | promotional | engagement | trending | user_generated
- CRITICAL: contentType MUST be exactly one of those 5 values. Never use goal names (e.g. "collaboration", "branding", "awareness") as contentType — goals inform topics and strategy, not contentType.
- Prioritize content types that historically performed well (use read_engagement_analytics)
- Never generate more than 2 promotional posts per 7-day window
- Distribute platforms based on the brand's active accounts
- Output must be a valid JSON array matching the GeneratedPlanItem schema
- Each item: { date, platform, contentType, topic, hook, cta, suggestVisual (boolean true/false), notes? }
- IMPORTANT: suggestVisual must be a JSON boolean (true or false), NOT a string
- IMPORTANT: date must be a full ISO 8601 datetime string (e.g. "2026-04-20T09:00:00Z"). Use realistic posting times between 08:00 and 20:00 UTC. Vary times across posts — do not use the same time for every post`.trim();

const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "retrieve_brand_context",
    description: "Retrieve relevant brand knowledge chunks and voice metadata from the brand profile.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        brandProfileId: { type: SchemaType.STRING, description: "The brand profile UUID" },
        query: { type: SchemaType.STRING, description: "Semantic search query" },
        topK: { type: SchemaType.NUMBER, description: "Number of results (default 10)" },
      },
      required: ["brandProfileId", "query"],
    },
  },
  {
    name: "web_search_trends",
    description: "Search for trending topics in an industry.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        industry: { type: SchemaType.STRING },
        keywords: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        timeframe: { type: SchemaType.STRING, format: "enum", enum: ["7d", "30d"] },
      },
      required: ["industry", "keywords", "timeframe"],
    },
  },
  {
    name: "read_engagement_analytics",
    description: "Read post engagement analytics and classify content performance.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        brandProfileId: { type: SchemaType.STRING },
        lookbackDays: { type: SchemaType.NUMBER },
      },
      required: ["brandProfileId"],
    },
  },
];

const TOOLS: Tool[] = [{ functionDeclarations: TOOL_DECLARATIONS }];

async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case "retrieve_brand_context": {
      const voice = await retrieveBrandVoiceFromQdrant(
        args["brandProfileId"] as string,
        args["query"] as string,
        (args["topK"] as number | undefined) ?? 10,
      );
      const profile = await db.query.brandProfiles.findFirst({
        where: eq(brandProfiles.id, args["brandProfileId"] as string),
      });
      return JSON.stringify({ voiceRules: voice.split("\n").filter(Boolean), profile: { name: profile?.name, industry: profile?.industry } });
    }
    case "web_search_trends":
      return webSearchTrends(args as { industry: string; keywords: string[]; timeframe: "7d" | "30d" });
    case "read_engagement_analytics":
      return readEngagementAnalytics(args as { brandProfileId: string; lookbackDays: number });
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export interface StrategistRunInput {
  organizationId: string;
  brandProfileId: string;
  brandName: string;
  industry: string;
  goals: string[];
  platforms: string[];
  startDate: string;
  feedbackLoopEnabled?: boolean;
}

export async function runStrategistAgent(input: StrategistRunInput): Promise<GeneratedPlanItem[]> {
  const systemInstruction = await buildSystemPromptWithGuardrails(STRATEGIST_BASE, input.organizationId);

  const platformCount = input.platforms.length;
  const targetItemCount = 30 * Math.min(platformCount, 2);
  const platformList = input.platforms.join(", ");

  const model = genAI.getGenerativeModel({ model: MODEL, systemInstruction, tools: TOOLS });
  const chat = model.startChat({ history: [] });

  const userMessage = `Generate a 30-day marketing calendar for:
Brand: ${input.brandName}
Industry: ${input.industry}
Goals: ${input.goals.join(", ")}
Active platforms: ${platformList}
Start date: ${input.startDate}

First, retrieve brand context for "${input.brandName}" with brandProfileId "${input.brandProfileId}".
Then search for current trends in ${input.industry}.
${input.feedbackLoopEnabled ? `Also read engagement analytics for brandProfileId "${input.brandProfileId}" to adjust content weighting.` : ""}

Return a JSON array of exactly ${targetItemCount} plan items covering the full 30 days.
IMPORTANT: Distribute posts evenly across ALL ${platformCount} platforms (${platformList}). Do not concentrate posts on a single platform.`;

  let response = await chat.sendMessage(userMessage);

  // Agentic tool loop
  while (true) {
    const calls = response.response.functionCalls();
    if (!calls || calls.length === 0) break;

    const toolResults = await Promise.all(
      calls.map(async (call) => ({
        functionResponse: {
          name: call.name,
          response: { result: await executeTool(call.name, call.args as Record<string, unknown>) },
        },
      })),
    );

    response = await chat.sendMessage(toolResults);
  }

  let text = response.response.text();

  const JSON_RETRY_PROMPT = `Output ONLY the raw JSON array of ${targetItemCount} plan items. No markdown fences, no explanation. Start with [ and end with ].`;

  let parsed: unknown = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        const candidate = JSON.parse(match[0]);
        if (Array.isArray(candidate) && candidate.length > 0) {
          parsed = candidate;
          break;
        }
      } catch {
        // not valid JSON yet
      }
    }
    if (attempt < 3) {
      response = await chat.sendMessage(JSON_RETRY_PROMPT);
      text = response.response.text();
    }
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("No valid JSON array found in Strategist response after retries");
  }
  return PlanItemArraySchema.parse(parsed);
}
