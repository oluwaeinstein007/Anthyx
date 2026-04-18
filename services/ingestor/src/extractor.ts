import { GoogleGenerativeAI } from "@google/generative-ai";
import { BrandExtractionSchema, type BrandExtraction } from "@anthyx/config";

const genAI = new GoogleGenerativeAI(process.env["GEMINI_API_KEY"] ?? "");
const MODEL = process.env["GEMINI_EXTRACTION_MODEL"] ?? "gemini-1.5-flash";

const EXTRACTION_PROMPT = `You are a brand analyst. Analyze the following brand document and extract structured data.

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

Document:`.trim();

export async function extractBrandData(documentText: string): Promise<BrandExtraction> {
  const truncated = documentText.slice(0, 12_000);

  const model = genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: { responseMimeType: "application/json" },
  });

  const result = await model.generateContent(`${EXTRACTION_PROMPT}\n\n${truncated}`);
  const raw = JSON.parse(result.response.text()) as unknown;
  return BrandExtractionSchema.parse(raw);
}
