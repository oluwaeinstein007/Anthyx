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
  strictMode?: boolean; // tighten thresholds when analytics show clear underperformers
}

export async function runReviewerAgent(input: ReviewerRunInput): Promise<ReviewerOutput> {
  const platformConstraints = getPlatformConstraints(input.platform);
  const strictNote = input.strictMode
    ? "\n\nSTRICT MODE (analytics-driven): Historical engagement data shows clear underperformers for this brand. Apply a tighter bar — flag content that feels generic, off-trend, or unlikely to outperform past results. Prefer 'rewrite' over 'pass' for borderline cases."
    : "";

  const instagramHashtagNote =
    input.platform === "instagram"
      ? "\nNOTE: The HASHTAGS field below is stored separately and will be auto-posted as the first comment — do NOT flag hashtags for being in the caption. Only flag if #tags appear inside the POST CONTENT text itself."
      : "";

  const userMessage = `
Review this post:

POST CONTENT:
"${input.postContent}"

HASHTAGS (separate field${input.platform === "instagram" ? ", posted as first comment" : ""}): ${input.hashtags.join(", ")}

PLATFORM RULES:
${platformConstraints}${instagramHashtagNote}

BRAND RULES:
${input.brandRules}

AGENT DIET INSTRUCTIONS:
${input.dietInstructions || "None"}${strictNote}

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
