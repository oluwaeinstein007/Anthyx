import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, Tool } from "@anthropic-ai/sdk/resources/messages";
import { PlanItemArraySchema } from "@anthyx/config";
import type { GeneratedPlanItem } from "@anthyx/types";
import { buildSystemPromptWithGuardrails } from "./guardrails";
import { retrieveBrandContextTool } from "../../mcp/tools/retrieve-brand-context";
import { webSearchTrendsTool } from "../../mcp/tools/web-search-trends";
import { readEngagementAnalyticsTool } from "../../mcp/tools/read-engagement-analytics";

const claude = new Anthropic({ apiKey: process.env["ANTHROPIC_API_KEY"] });

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
- Each item: { date, platform, contentType, topic, hook, cta, suggestVisual, notes? }
`.trim();

const STRATEGIST_TOOLS: Tool[] = [
  {
    name: retrieveBrandContextTool.name,
    description: retrieveBrandContextTool.description,
    input_schema: {
      type: "object" as const,
      properties: {
        brandProfileId: { type: "string", description: "The brand profile ID" },
        query: { type: "string", description: "Search query" },
        topK: { type: "number", description: "Number of results" },
      },
      required: ["brandProfileId", "query"],
    },
  },
  {
    name: webSearchTrendsTool.name,
    description: webSearchTrendsTool.description,
    input_schema: {
      type: "object" as const,
      properties: {
        industry: { type: "string" },
        keywords: { type: "array", items: { type: "string" } },
        timeframe: { type: "string", enum: ["7d", "30d"] },
      },
      required: ["industry", "keywords", "timeframe"],
    },
  },
  {
    name: readEngagementAnalyticsTool.name,
    description: readEngagementAnalyticsTool.description,
    input_schema: {
      type: "object" as const,
      properties: {
        brandProfileId: { type: "string" },
        lookbackDays: { type: "number" },
      },
      required: ["brandProfileId"],
    },
  },
];

async function executeToolCall(
  toolName: string,
  toolInput: Record<string, unknown>,
): Promise<unknown> {
  switch (toolName) {
    case retrieveBrandContextTool.name:
      return retrieveBrandContextTool.handler(toolInput as Parameters<typeof retrieveBrandContextTool.handler>[0]);
    case webSearchTrendsTool.name:
      return webSearchTrendsTool.handler(toolInput as Parameters<typeof webSearchTrendsTool.handler>[0]);
    case readEngagementAnalyticsTool.name:
      return readEngagementAnalyticsTool.handler(toolInput as Parameters<typeof readEngagementAnalyticsTool.handler>[0]);
    default:
      throw new Error(`Unknown tool: ${toolName}`);
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

export async function runStrategistAgent(
  input: StrategistRunInput,
): Promise<GeneratedPlanItem[]> {
  const systemPrompt = await buildSystemPromptWithGuardrails(
    STRATEGIST_BASE_PROMPT,
    input.organizationId,
  );

  const userMessage = `
Generate a 30-day marketing calendar for:
Brand: ${input.brandName}
Industry: ${input.industry}
Goals: ${input.goals.join(", ")}
Active platforms: ${input.platforms.join(", ")}
Start date: ${input.startDate}

First, retrieve brand context for "${input.brandName}" with brandProfileId "${input.brandProfileId}".
Then search for current trends in ${input.industry}.
${input.feedbackLoopEnabled ? `Also read engagement analytics for brandProfileId "${input.brandProfileId}" to adjust content weighting.` : ""}

Return a JSON array of 30 plan items covering the full 30 days.
`.trim();

  const messages: MessageParam[] = [{ role: "user", content: userMessage }];

  let response = await claude.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 8096,
    system: systemPrompt,
    tools: STRATEGIST_TOOLS,
    messages,
  });

  // Agentic loop — Strategist uses tools until it has enough context
  while (response.stop_reason === "tool_use") {
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolUseBlocks.map(async (toolUse) => {
        const result = await executeToolCall(
          toolUse.name,
          toolUse.input as Record<string, unknown>,
        );
        return {
          type: "tool_result" as const,
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        };
      }),
    );

    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: toolResults });

    response = await claude.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 8096,
      system: systemPrompt,
      tools: STRATEGIST_TOOLS,
      messages,
    });
  }

  const raw = extractJson(response.content);
  return PlanItemArraySchema.parse(raw);
}

function extractJson(content: Anthropic.ContentBlock[]): unknown {
  const text = content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  // Find JSON array in the response
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("No JSON array found in Strategist response");
  return JSON.parse(match[0]);
}
