import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";

const genAI = new GoogleGenerativeAI(process.env["GEMINI_API_KEY"] ?? "");
const claude = new Anthropic({ apiKey: process.env["ANTHROPIC_API_KEY"] });

export const GEMINI_PRO = process.env["GEMINI_PRO_MODEL"] ?? "gemini-1.5-pro";
export const GEMINI_FLASH = process.env["GEMINI_FLASH_MODEL"] ?? "gemini-1.5-flash";
export const CLAUDE_SONNET = "claude-sonnet-4-6";
export const CLAUDE_HAIKU = "claude-haiku-4-5-20251001";

/**
 * Generate text via Gemini, falling back to Claude on failure.
 * Both Gemini and Claude support a system instruction + user message pattern.
 */
export async function generateWithFallback({
  systemPrompt,
  userMessage,
  geminiModel = GEMINI_FLASH,
  claudeModel = CLAUDE_HAIKU,
  maxTokens = 1024,
}: {
  systemPrompt: string;
  userMessage: string;
  geminiModel?: string;
  claudeModel?: string;
  maxTokens?: number;
}): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({
      model: geminiModel,
      systemInstruction: systemPrompt,
    });
    const result = await model.generateContent(userMessage);
    return result.response.text();
  } catch (geminiErr) {
    console.warn(`[LLMClient] Gemini (${geminiModel}) failed, falling back to Claude:`, geminiErr);

    const response = await claude.messages.create({
      model: claudeModel,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    return response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
  }
}

export function extractJsonObject(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?\n?/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON object found in LLM response");
  return JSON.parse(match[0]);
}

export function extractJsonArray(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?\n?/g, "").trim();
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("No JSON array found in LLM response");
  return JSON.parse(match[0]);
}
