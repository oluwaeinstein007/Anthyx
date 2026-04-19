import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { FunctionDeclaration, Tool } from "@google/generative-ai";
import { PlanItemArraySchema } from "@anthyx/config";
import type { GeneratedPlanItem } from "@anthyx/types";
import { buildSystemPromptWithGuardrails } from "./guardrails";
import { retrieveBrandContextTool } from "../../mcp/tools/retrieve-brand-context";
import { webSearchTrendsTool } from "../../mcp/tools/web-search-trends";
import { readEngagementAnalyticsTool } from "../../mcp/tools/read-engagement-analytics";

const genAI = new GoogleGenerativeAI(process.env["GEMINI_API_KEY"] ?? "");
const MODEL = process.env["GEMINI_STRATEGIST_MODEL"] ?? "gemini-1.5-pro";

const STRATEGIST_BASE_PROMPT = `
You are a senior digital marketing strategist.
You generate data-driven, brand-aligned 30-day marketing calendars.
You have access to tools to retrieve brand context, search for industry trends,
and read past engagement performance.

Rules:
- Every plan item must map to a content pillar: educational | promotional | engagement | trending | user_generated
- Prioritize content types that historically performed well (use read_engagement_analytics)
- Never generate more than 2 promotional posts per 7-day window
- Distribute platforms based on the brand's active accounts
- Output must be a valid JSON array matching the GeneratedPlanItem schema
- Each item: { date, platform, contentType, topic, hook, cta, suggestVisual (boolean true/false), notes? }
- IMPORTANT: suggestVisual must be a JSON boolean (true or false), NOT a string
- IMPORTANT: date must be a full ISO 8601 datetime string (e.g. "2026-04-20T09:00:00Z"). Use realistic posting times between 08:00 and 20:00 UTC. Vary times across posts — do not use the same time for every post
`.trim();

const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: retrieveBrandContextTool.name,
    description: retrieveBrandContextTool.description,
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
    name: webSearchTrendsTool.name,
    description: webSearchTrendsTool.description,
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
    name: readEngagementAnalyticsTool.name,
    description: readEngagementAnalyticsTool.description,
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

async function executeToolCall(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case retrieveBrandContextTool.name:
      return retrieveBrandContextTool.handler(args as Parameters<typeof retrieveBrandContextTool.handler>[0]);
    case webSearchTrendsTool.name:
      return webSearchTrendsTool.handler(args as Parameters<typeof webSearchTrendsTool.handler>[0]);
    case readEngagementAnalyticsTool.name:
      return readEngagementAnalyticsTool.handler(args as Parameters<typeof readEngagementAnalyticsTool.handler>[0]);
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
  durationDays: number;
  feedbackLoopEnabled?: boolean;
}

export async function runStrategistAgent(input: StrategistRunInput): Promise<GeneratedPlanItem[]> {
  const systemInstruction = await buildSystemPromptWithGuardrails(
    STRATEGIST_BASE_PROMPT,
    input.organizationId,
  );

  // Generate enough items to spread across all selected platforms
  // (up to 2 posts per day when multiple platforms are selected)
  const platformCount = input.platforms.length;
  const targetItemCount = input.durationDays * Math.min(platformCount, 2);

  const model = genAI.getGenerativeModel({ model: MODEL, systemInstruction, tools: TOOLS });
  const chat = model.startChat({ history: [] });

  const platformList = input.platforms.join(", ");
  const userMessage = `
Generate a ${input.durationDays}-day marketing calendar for:
Brand: ${input.brandName}
Industry: ${input.industry}
Goals: ${input.goals.join(", ")}
Active platforms: ${platformList}
Start date: ${input.startDate}

First, retrieve brand context for "${input.brandName}" with brandProfileId "${input.brandProfileId}".
Then search for current trends in ${input.industry}.
${input.feedbackLoopEnabled ? `Also read engagement analytics for brandProfileId "${input.brandProfileId}" to adjust content weighting.` : ""}

Return a JSON array of exactly ${targetItemCount} plan items covering the full ${input.durationDays} days.
IMPORTANT: Distribute posts evenly across ALL ${platformCount} platforms (${platformList}). Each platform must appear roughly equally. Do not concentrate posts on a single platform.
`.trim();

  let response = await chat.sendMessage(userMessage);

  while (true) {
    const calls = response.response.functionCalls();
    if (!calls || calls.length === 0) break;

    const toolResults = await Promise.all(
      calls.map(async (call) => ({
        functionResponse: {
          name: call.name,
          response: { result: JSON.stringify(await executeToolCall(call.name, call.args as Record<string, unknown>)) },
        },
      })),
    );

    response = await chat.sendMessage(toolResults);
  }

  let text = response.response.text();

  const { extractJsonArray } = await import("./llm-client");
  const JSON_RETRY_PROMPT = `Output ONLY the raw JSON array of ${targetItemCount} plan items. No markdown fences, no explanation. Start with [ and end with ].`;

  let parsed: unknown = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const candidate = extractJsonArray(text);
      if (Array.isArray(candidate) && candidate.length > 0) {
        parsed = candidate;
        break;
      }
    } catch {
      // not valid JSON yet
    }
    if (attempt < 3) {
      response = await chat.sendMessage(JSON_RETRY_PROMPT);
      text = response.response.text();
    }
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Strategist returned no valid JSON array after retries");
  }

  return PlanItemArraySchema.parse(parsed);
}
