import Anthropic from "@anthropic-ai/sdk";
import { BrandExtractionSchema, type BrandExtraction } from "@anthyx/config";

const claude = new Anthropic({ apiKey: process.env["ANTHROPIC_API_KEY"] });

const EXTRACTION_PROMPT = `
You are a brand analyst. Analyze the following brand document and extract structured data.

Return ONLY valid JSON in this exact format:
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

If a field cannot be determined from the document, use sensible defaults:
- colors: use [] if none found
- voiceTraits: default false for each
- typography: null for both fields

Document:
`.trim();

export async function extractBrandData(documentText: string): Promise<BrandExtraction> {
  // Truncate to avoid token limits while keeping the most important content
  const truncated = documentText.slice(0, 12_000);

  const response = await claude.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `${EXTRACTION_PROMPT}\n\n${truncated}`,
      },
    ],
  });

  const raw = extractJson(response.content);
  return BrandExtractionSchema.parse(raw);
}

function extractJson(content: Anthropic.ContentBlock[]): unknown {
  const text = content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  // Strip markdown code fences if present
  const cleaned = text.replace(/```(?:json)?\n?/g, "").trim();
  return JSON.parse(cleaned);
}
