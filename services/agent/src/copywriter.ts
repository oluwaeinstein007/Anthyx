import { GoogleGenerativeAI } from "@google/generative-ai";
import { CopywriterOutputSchema } from "@anthyx/config";
import type { CopywriterOutput, Platform } from "@anthyx/types";
import { getPlatformConstraints } from "./prompt-builder.js";
import { buildSystemPromptWithGuardrails } from "./guardrails.js";

const genAI = new GoogleGenerativeAI(process.env["GEMINI_API_KEY"] ?? "");
const MODEL = process.env["GEMINI_COPYWRITER_MODEL"] ?? "gemini-1.5-flash";

export interface CopywriterRunInput {
  organizationId: string;
  personaName: string;
  brandName: string;
  brandVoiceRules: string;
  dietInstructions: string;
  platform: Platform;
  topic: string;
  contentType: string;
  hook: string;
  cta: string;
  scheduledAt: string;
}

function buildBasePrompt(ctx: CopywriterRunInput): string {
  return `You are ${ctx.personaName}, a social media copywriter for ${ctx.brandName}.

## Brand Voice Rules
${ctx.brandVoiceRules}

## Persona Instructions
${ctx.dietInstructions || "No specific persona instructions."}

## Platform: ${ctx.platform.toUpperCase()}
${getPlatformConstraints(ctx.platform)}

## Assignment
Write a single post for:
- Topic: ${ctx.topic}
- Content Pillar: ${ctx.contentType}
- Hook suggestion: ${ctx.hook}
- CTA: ${ctx.cta}
- Scheduled date: ${ctx.scheduledAt}

Return ONLY valid JSON:
{
  "content": "final post text",
  "hashtags": ["tag1", "tag2"],
  "suggestedMediaPrompt": "DALL-E prompt if visual needed, otherwise null",
  "reasoning": "1-2 sentence explanation of creative choices"
}`.trim();
}

export async function runCopywriterAgent(input: CopywriterRunInput): Promise<CopywriterOutput> {
  const basePrompt = buildBasePrompt(input);
  const systemInstruction = await buildSystemPromptWithGuardrails(basePrompt, input.organizationId);

  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction,
    generationConfig: { responseMimeType: "application/json" },
  });

  const result = await model.generateContent("Write the post. Return only valid JSON.");
  const raw = JSON.parse(result.response.text()) as unknown;
  return CopywriterOutputSchema.parse(raw);
}
