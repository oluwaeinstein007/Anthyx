import { ReviewerOutputSchema } from "@anthyx/config";
import type { ReviewerOutput, Platform } from "@anthyx/types";
import { getPlatformConstraints } from "./prompt-builder";
import { generateWithFallback, extractJsonObject, GEMINI_FLASH, CLAUDE_HAIKU } from "./llm-client";

const REVIEWER_SYSTEM_PROMPT = `
You are a strict brand compliance reviewer.
Your only job is to evaluate whether a social media post passes or fails against
the provided brand rules and agent diet instructions.
You are adversarial — err on the side of rejection if in doubt.
You have no attachment to the post you are reviewing.
You never see the Copywriter's reasoning — only the output.
`.trim();

export interface ReviewerRunInput {
  postContent: string;
  hashtags: string[];
  platform: Platform;
  brandRules: string;
  dietInstructions: string;
}

export async function runReviewerAgent(input: ReviewerRunInput): Promise<ReviewerOutput> {
  const platformConstraints = getPlatformConstraints(input.platform);

  const userMessage = `
Review this post:

POST CONTENT:
"${input.postContent}"

HASHTAGS: ${input.hashtags.join(", ")}

PLATFORM RULES:
${platformConstraints}

BRAND RULES:
${input.brandRules}

AGENT DIET INSTRUCTIONS:
${input.dietInstructions || "None"}

Return ONLY valid JSON:
{
  "verdict": "pass" | "fail" | "rewrite",
  "issues": ["specific issue 1"],
  "revisedContent": "corrected post text if verdict is rewrite, else null",
  "revisedHashtags": ["tag1"] or null
}
`.trim();

  const text = await generateWithFallback({
    systemPrompt: REVIEWER_SYSTEM_PROMPT,
    userMessage,
    geminiModel: GEMINI_FLASH,
    claudeModel: CLAUDE_HAIKU,
    maxTokens: 1024,
  });

  return ReviewerOutputSchema.parse(extractJsonObject(text));
}
