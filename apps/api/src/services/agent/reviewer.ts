import { ReviewerOutputSchema } from "@anthyx/config";
import type { ReviewerOutput, Platform } from "@anthyx/types";
import { getPlatformConstraints } from "./prompt-builder";
import { generateWithFallback, extractJsonObject, GEMINI_FLASH, CLAUDE_HAIKU } from "./llm-client";

const REVIEWER_SYSTEM_PROMPT = `
You are a brand compliance reviewer for social media content.
Your job is to evaluate whether a post passes or fails against brand rules and diet instructions.

Reject (verdict: "fail" or "rewrite") ONLY for clear violations:
- Explicitly prohibited content or topics
- Platform character limit exceeded
- Direct contradiction of brand voice or stated values
- Content that would embarrass or misrepresent the brand

Do NOT reject for:
- Not mentioning every technology or service the brand offers
- Minor stylistic preferences
- Broad or general topics that are still brand-aligned
- Missing specific details that weren't in the brief

A post about an industry topic that is consistent with the brand's voice and goals should PASS even if it doesn't exhaustively list every brand capability.
Err on the side of passing — most posts should pass or get a light rewrite, not fail.
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
    geminiModel: process.env["GEMINI_REVIEWER_MODEL"] ?? GEMINI_FLASH,
    claudeModel: CLAUDE_HAIKU,
    maxTokens: 1024,
  });

  return ReviewerOutputSchema.parse(extractJsonObject(text));
}
