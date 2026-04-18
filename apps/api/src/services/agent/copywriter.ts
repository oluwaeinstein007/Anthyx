import Anthropic from "@anthropic-ai/sdk";
import { CopywriterOutputSchema } from "@anthyx/config";
import type { CopywriterOutput } from "@anthyx/types";
import type { Platform } from "@anthyx/types";
import { getPlatformConstraints } from "./prompt-builder";
import { buildSystemPromptWithGuardrails } from "./guardrails";

const claude = new Anthropic({ apiKey: process.env["ANTHROPIC_API_KEY"] });

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
  "suggestedMediaPrompt": "DALL-E prompt if visual needed, otherwise null",
  "reasoning": "1-2 sentence explanation of creative choices"
}
`.trim();
}

export async function runCopywriterAgent(
  input: CopywriterRunInput,
): Promise<CopywriterOutput> {
  const basePrompt = buildCopywriterBasePrompt(input);
  const systemPrompt = await buildSystemPromptWithGuardrails(basePrompt, input.organizationId);

  const response = await claude.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Write the post. Return only valid JSON.`,
      },
    ],
  });

  const raw = extractJson(response.content);
  return CopywriterOutputSchema.parse(raw);
}

function extractJson(content: Anthropic.ContentBlock[]): unknown {
  const text = content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const cleaned = text.replace(/```(?:json)?\n?/g, "").trim();
  // Find JSON object
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON found in Copywriter response");
  return JSON.parse(match[0]);
}
