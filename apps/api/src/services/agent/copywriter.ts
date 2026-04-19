import { CopywriterOutputSchema } from "@anthyx/config";
import type { CopywriterOutput, Platform } from "@anthyx/types";
import { getPlatformConstraints } from "./prompt-builder";
import { buildSystemPromptWithGuardrails } from "./guardrails";
import { generateWithFallback, extractJsonObject, GEMINI_PRO, CLAUDE_SONNET } from "./llm-client";

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

function buildCopywriterBasePrompt(ctx: CopywriterRunInput): string {
  return `
You are ${ctx.personaName}, a social media copywriter for ${ctx.brandName}.

## Brand Voice Rules (retrieved from brand memory)
${ctx.brandVoiceRules}

## Your Persona Instructions (Diet Instructions)
${ctx.dietInstructions || "No specific persona instructions."}

## Platform: ${ctx.platform.toUpperCase()}
${getPlatformConstraints(ctx.platform)}

## Assignment
Write a single post for the following plan item:
- Topic: ${ctx.topic}
- Content Pillar: ${ctx.contentType}
- Hook suggestion: ${ctx.hook}
- CTA: ${ctx.cta}
- Scheduled date: ${ctx.scheduledAt}

## Output (return ONLY valid JSON, no prose)
{
  "content": "final post text",
  "hashtags": ["tag1", "tag2"],
  "suggestedMediaPrompt": "image prompt if visual needed, otherwise null",
  "reasoning": "1-2 sentence explanation of creative choices"
}
`.trim();
}

export async function runCopywriterAgent(input: CopywriterRunInput): Promise<CopywriterOutput> {
  const basePrompt = buildCopywriterBasePrompt(input);
  const systemPrompt = await buildSystemPromptWithGuardrails(basePrompt, input.organizationId);

  const text = await generateWithFallback({
    systemPrompt,
    userMessage: "Write the post. Return only valid JSON.",
    geminiModel: process.env["GEMINI_COPYWRITER_MODEL"] ?? GEMINI_PRO,
    claudeModel: CLAUDE_SONNET,
    maxTokens: 1024,
  });

  return CopywriterOutputSchema.parse(extractJsonObject(text));
}
