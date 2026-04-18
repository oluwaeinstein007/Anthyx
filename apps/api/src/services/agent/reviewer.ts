import Anthropic from "@anthropic-ai/sdk";
import { ReviewerOutputSchema } from "@anthyx/config";
import type { ReviewerOutput } from "@anthyx/types";
import type { Platform } from "@anthyx/types";
import { getPlatformConstraints } from "./prompt-builder";

const claude = new Anthropic({ apiKey: process.env["ANTHROPIC_API_KEY"] });

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

  const response = await claude.messages.create({
    model: "claude-haiku-4-5-20251001", // fast + cheap for compliance checks
    max_tokens: 1024,
    system: REVIEWER_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `
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
        `.trim(),
      },
    ],
  });

  const raw = extractJson(response.content);
  return ReviewerOutputSchema.parse(raw);
}

function extractJson(content: Anthropic.ContentBlock[]): unknown {
  const text = content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const cleaned = text.replace(/```(?:json)?\n?/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON found in Reviewer response");
  return JSON.parse(match[0]);
}
