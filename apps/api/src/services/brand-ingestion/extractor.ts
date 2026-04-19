import { BrandExtractionSchema, type BrandExtraction } from "@anthyx/config";
import { generateWithFallback, extractJsonObject, GEMINI_FLASH, CLAUDE_HAIKU } from "../agent/llm-client";

const EXTRACTION_SYSTEM_PROMPT = `
You are a brand analyst. Analyze brand documents and extract structured data.
Return ONLY valid JSON — no prose, no markdown fences.
`.trim();

const EXTRACTION_USER_TEMPLATE = (doc: string) => `
Analyze the following brand document and extract structured data in this exact JSON format:
{
  "industry": "string",
  "voiceTraits": {
    "professional": boolean,
    "witty": boolean,
    "aggressive": boolean,
    "empathetic": boolean,
    "authoritative": boolean,
    "casual": boolean
  },
  "toneDescriptors": ["string"],
  "primaryColors": ["#hexcode"],
  "secondaryColors": ["#hexcode"],
  "typography": {
    "primary": "font name or null",
    "secondary": "font name or null"
  },
  "brandStatements": ["key brand messages, max 5"],
  "audienceNotes": ["target audience descriptors, max 3"]
}

If a field cannot be determined, use sensible defaults (empty arrays, false booleans, null strings).

Document:
${doc}
`.trim();

export async function extractBrandData(documentText: string): Promise<BrandExtraction> {
  const truncated = documentText.slice(0, 12_000);

  const text = await generateWithFallback({
    systemPrompt: EXTRACTION_SYSTEM_PROMPT,
    userMessage: EXTRACTION_USER_TEMPLATE(truncated),
    geminiModel: process.env["GEMINI_EXTRACTION_MODEL"] ?? GEMINI_FLASH,
    claudeModel: CLAUDE_HAIKU,
    maxTokens: 1024,
  });

  return BrandExtractionSchema.parse(extractJsonObject(text));
}
