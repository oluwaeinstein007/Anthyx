import { BrandExtractionSchema, type BrandExtraction } from "@anthyx/config";
import { generateWithFallback, extractJsonObject, GEMINI_FLASH, CLAUDE_HAIKU } from "../agent/llm-client";

const EXTRACTION_SYSTEM_PROMPT = `
You are a brand analyst. Analyze brand documents and extract structured data.
Return ONLY valid JSON — no prose, no markdown fences.
`.trim();

const EXTRACTION_USER_TEMPLATE = (doc: string) => `
Analyze the following brand document and extract structured data in this exact JSON format:
{
  "industry": "string — the industry or vertical this brand operates in",
  "voiceTraits": {
    "professional": boolean,
    "witty": boolean,
    "aggressive": boolean,
    "empathetic": boolean,
    "authoritative": boolean,
    "casual": boolean
  },
  "toneDescriptors": ["adjective descriptors of the brand tone, e.g. 'bold', 'warm', 'trustworthy'"],
  "primaryColors": ["#hexcode"],
  "secondaryColors": ["#hexcode"],
  "typography": {
    "primary": "font name or null",
    "secondary": "font name or null"
  },
  "brandStatements": ["key brand messages or taglines, max 5"],
  "audienceNotes": ["target audience descriptors, max 3, e.g. 'busy professionals aged 30-45'"],
  "productsServices": ["list of specific products or services the brand offers, max 10 — be specific, e.g. 'email marketing software', 'brand strategy consulting'"],
  "valueProposition": "one sentence describing what makes this brand uniquely valuable to customers, or null if not determinable",
  "targetMarket": "a concise description of the primary target market/customer segment, or null if not determinable",
  "contentPillars": ["3–6 content themes or topic categories this brand should consistently post about, e.g. 'industry tips', 'behind the scenes', 'customer stories'"],
  "competitors": ["known competitor brand names if mentioned, max 5, empty array if none found"]
}

Rules:
- If a field cannot be determined from the document, use sensible defaults (empty arrays, false booleans, null strings).
- For productsServices, be specific — list actual product/service names, not categories.
- For contentPillars, infer from the brand's audience, industry, and voice even if not explicitly stated.
- For hex colors, only include actual hex codes found in the document. Use empty arrays if none.

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
    maxTokens: 1500,
  });

  return BrandExtractionSchema.parse(extractJsonObject(text));
}
