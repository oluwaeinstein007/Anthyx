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
  targetLocale?: string; // e.g. "es-MX" — write the post in this language/locale
  engagementInsights?: string; // analytics-derived tone/style guidance for deeper feedback loop
  threadMode?: boolean; // if true, output a segments[] array for thread/carousel support
  vetoGuidance?: string; // negative examples from vetoed content — patterns to avoid
}

function buildCopywriterBasePrompt(ctx: CopywriterRunInput): string {
  const localeSection = ctx.targetLocale
    ? `\n## Language\nWrite the post in the locale "${ctx.targetLocale}". All content, hashtags, and CTAs must be in that language.\n`
    : "";

  const insightsSection = ctx.engagementInsights
    ? `\n## Performance Insights (adjust your tone accordingly)\n${ctx.engagementInsights}\n`
    : "";

  const vetoSection = ctx.vetoGuidance
    ? `\n${ctx.vetoGuidance}\n`
    : "";

  const threadSection = ctx.threadMode
    ? `\n## Thread / Carousel Mode\nThis post should be formatted as a thread (X) or carousel (Instagram). Break the content into 3–7 distinct segments. Each segment is a self-contained slide or tweet. The first segment must hook; the last must CTA. Output a "segments" array alongside "content" (which contains the full combined text for fallback).\n`
    : "";

  const outputSchema = ctx.threadMode
    ? `{
  "content": "full combined post text (fallback)",
  "segments": ["segment 1 text", "segment 2 text", "..."],
  "hashtags": ["tag1", "tag2"],
  "suggestedMediaPrompt": "image prompt if visual needed, otherwise null",
  "reasoning": "1-2 sentence explanation of creative choices"
}`
    : `{
  "content": "final post text",
  "hashtags": ["tag1", "tag2"],
  "suggestedMediaPrompt": "image prompt if visual needed, otherwise null",
  "reasoning": "1-2 sentence explanation of creative choices"
}`;

  return `
You are ${ctx.personaName}, a social media copywriter for ${ctx.brandName}.

## Brand Voice Rules (retrieved from brand memory)
${ctx.brandVoiceRules}

## Your Persona Instructions (Diet Instructions)
${ctx.dietInstructions || "No specific persona instructions."}

## Platform: ${ctx.platform.toUpperCase()}
${getPlatformConstraints(ctx.platform)}
${localeSection}${insightsSection}${vetoSection}${threadSection}
## Assignment
Write a single post for the following plan item:
- Topic: ${ctx.topic}
- Content Pillar: ${ctx.contentType}
- Hook suggestion: ${ctx.hook}
- CTA: ${ctx.cta}
- Scheduled date: ${ctx.scheduledAt}

## Output (return ONLY valid JSON, no prose)
${outputSchema}
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
    maxTokens: 2048,
  });

  return CopywriterOutputSchema.parse(extractJsonObject(text));
}
