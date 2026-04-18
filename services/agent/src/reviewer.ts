import { GoogleGenerativeAI } from "@google/generative-ai";
import { ReviewerOutputSchema } from "@anthyx/config";
import type { ReviewerOutput, Platform } from "@anthyx/types";
import { getPlatformConstraints } from "./prompt-builder.js";

const genAI = new GoogleGenerativeAI(process.env["GEMINI_API_KEY"] ?? "");
const MODEL = process.env["GEMINI_REVIEWER_MODEL"] ?? "gemini-1.5-flash-8b";

const REVIEWER_SYSTEM = `You are a strict brand compliance reviewer.
Your only job is to evaluate whether a social media post passes or fails against
the provided brand rules and agent diet instructions.
You are adversarial — err on the side of rejection if in doubt.
You have no attachment to the post you are reviewing.
You never see the Copywriter's reasoning — only the output.`.trim();

export interface ReviewerRunInput {
  postContent: string;
  hashtags: string[];
  platform: Platform;
  brandRules: string;
  dietInstructions: string;
}

export async function runReviewerAgent(input: ReviewerRunInput): Promise<ReviewerOutput> {
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: REVIEWER_SYSTEM,
    generationConfig: { responseMimeType: "application/json" },
  });

  const prompt = `Review this post:

POST CONTENT:
"${input.postContent}"

HASHTAGS: ${input.hashtags.join(", ")}

PLATFORM RULES:
${getPlatformConstraints(input.platform)}

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
}`;

  const result = await model.generateContent(prompt);
  const raw = JSON.parse(result.response.text()) as unknown;
  return ReviewerOutputSchema.parse(raw);
}
