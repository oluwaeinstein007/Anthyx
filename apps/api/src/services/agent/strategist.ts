import { GoogleGenerativeAI, SchemaType, type ResponseSchema } from "@google/generative-ai";
import type { FunctionDeclaration, Tool } from "@google/generative-ai";
import { PlanItemArraySchema } from "@anthyx/config";
import type { GeneratedPlanItem } from "@anthyx/types";
import { buildSystemPromptWithGuardrails } from "./guardrails";
import { retrieveBrandContextTool } from "../../mcp/tools/retrieve-brand-context";
import { webSearchTrendsTool } from "../../mcp/tools/web-search-trends";
import { readEngagementAnalyticsTool } from "../../mcp/tools/read-engagement-analytics";
import { competitorAnalysisTool } from "../../mcp/tools/competitor-analysis";

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
- Distribute posts evenly across ALL provided platforms regardless of account link status
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
  {
    name: competitorAnalysisTool.name,
    description: competitorAnalysisTool.description,
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        industry: { type: SchemaType.STRING },
        competitors: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        platforms: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        lookbackDays: { type: SchemaType.NUMBER },
      },
      required: ["industry", "competitors", "platforms"],
    },
  },
];

const TOOLS: Tool[] = [{ functionDeclarations: TOOL_DECLARATIONS }];

// Structured output schema for the final plan item array — eliminates the retry loop
const PLAN_ITEM_RESPONSE_SCHEMA: ResponseSchema = {
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: {
      date: { type: SchemaType.STRING },
      platform: { type: SchemaType.STRING },
      contentType: { type: SchemaType.STRING },
      topic: { type: SchemaType.STRING },
      hook: { type: SchemaType.STRING },
      cta: { type: SchemaType.STRING },
      suggestVisual: { type: SchemaType.BOOLEAN },
      notes: { type: SchemaType.STRING },
    },
    required: ["date", "platform", "contentType", "topic", "hook", "cta", "suggestVisual"],
  },
};

async function executeToolCall(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case retrieveBrandContextTool.name:
      return retrieveBrandContextTool.handler(args as Parameters<typeof retrieveBrandContextTool.handler>[0]);
    case webSearchTrendsTool.name:
      return webSearchTrendsTool.handler(args as Parameters<typeof webSearchTrendsTool.handler>[0]);
    case readEngagementAnalyticsTool.name:
      return readEngagementAnalyticsTool.handler(args as Parameters<typeof readEngagementAnalyticsTool.handler>[0]);
    case competitorAnalysisTool.name:
      return competitorAnalysisTool.handler(args as Parameters<typeof competitorAnalysisTool.handler>[0]);
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
  targetLocale?: string; // e.g. "es-MX", "fr-FR", "pt-BR" — content generated in that language
  competitors?: string[]; // brand names/handles to run competitor analysis against
}

export async function runStrategistAgent(input: StrategistRunInput): Promise<GeneratedPlanItem[]> {
  const systemInstruction = await buildSystemPromptWithGuardrails(
    STRATEGIST_BASE_PROMPT,
    input.organizationId,
  );

  const platformCount = input.platforms.length;
  const targetItemCount = input.durationDays * platformCount;
  const platformList = input.platforms.join(", ");

  // Phase 1: Tool-calling model to gather research context.
  // Gemini does not allow tools + responseMimeType together, so JSON output
  // is kept entirely out of this phase.
  const researchModel = genAI.getGenerativeModel({ model: MODEL, systemInstruction, tools: TOOLS });
  const chat = researchModel.startChat({ history: [] });

  const localeInstruction = input.targetLocale
    ? `\nLanguage / Locale: Generate ALL post content (topic, hook, cta, notes) in the locale "${input.targetLocale}". Do not fall back to English unless the locale is "en-*".`
    : "";

  const researchMessage = `Research task for a ${input.durationDays}-day marketing plan:
Brand: ${input.brandName}
Industry: ${input.industry}
Goals: ${input.goals.join(", ")}
Target platforms: ${platformList}${localeInstruction}
Start date: ${input.startDate}

Please do the following using your tools:
1. Retrieve brand context for "${input.brandName}" (brandProfileId: "${input.brandProfileId}").
2. Search for current trends in ${input.industry}.
${input.feedbackLoopEnabled ? `3. Read engagement analytics for brandProfileId "${input.brandProfileId}" to identify top-performing content types.` : ""}
${input.competitors?.length ? `4. Run competitor_analysis for competitors [${input.competitors.join(", ")}] in ${input.industry} on [${input.platforms.join(", ")}].` : ""}

Summarise all findings in plain text. Do NOT output the marketing calendar yet.`;

  let response = await chat.sendMessage(researchMessage);

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

  const researchSummary = response.response.text();

  // Phase 2: Formatter model — no tools, uses structured output to produce JSON.
  const formatterModel = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: PLAN_ITEM_RESPONSE_SCHEMA,
    },
  });

  const formatPrompt = `You are given research context for a ${input.durationDays}-day marketing plan. Output ONLY a valid JSON array of exactly ${targetItemCount} plan items. No markdown, no explanation.

RESEARCH CONTEXT:
${researchSummary}

PLAN REQUIREMENTS:
Brand: ${input.brandName}
Industry: ${input.industry}
Goals: ${input.goals.join(", ")}
Platforms: ${platformList} (distribute evenly across ALL ${platformCount} platforms)${localeInstruction}
Start date: ${input.startDate}
Duration: ${input.durationDays} days
Total items: ${targetItemCount} (exactly 1 post per platform per day)

CRITICAL DISTRIBUTION RULES:
- EVERY single day from day 1 to day ${input.durationDays} MUST have exactly ${platformCount} posts (one per platform)
- Do NOT skip any day — no day should have zero posts
- Spread posts evenly: each day gets one post for each of: ${platformList}
- Platforms may not have social accounts linked yet — generate posts for ALL of them anyway
Each item must have: { date (ISO 8601), platform, contentType, topic, hook, cta, suggestVisual (boolean), notes? }
contentType must be exactly one of: educational | promotional | engagement | trending | user_generated`;

  const formatResult = await formatterModel.generateContent(formatPrompt);
  const text = formatResult.response.text();
  const parsed: unknown = JSON.parse(text);

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Strategist returned an empty plan array");
  }

  return PlanItemArraySchema.parse(parsed);
}
