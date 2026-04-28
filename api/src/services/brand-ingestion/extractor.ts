import { BrandExtractionSchema, type BrandExtraction } from "@anthyx/config";
import { generateWithFallback, extractJsonObject, GEMINI_FLASH, CLAUDE_HAIKU } from "../agent/llm-client";

const EXTRACTION_SYSTEM_PROMPT = `
You are a brand analyst. Analyze brand documents and extract structured data.
Return ONLY valid JSON — no prose, no markdown fences.
`.trim();

const EXTRACTION_USER_TEMPLATE = (doc: string) => `
Analyze the following brand document and extract structured data in this exact JSON format:
{
  "industry": "the industry or vertical this brand operates in",
  "tagline": "short memorable tagline or slogan verbatim from the document, or null",
  "websiteUrl": "brand website URL if mentioned (include https://), or null",
  "brandEmail": "brand contact email if mentioned, or null",
  "brandStage": "one of: idea | startup | growth | established | enterprise — infer from context, or null",
  "missionStatement": "what the brand does and for whom — extract verbatim or infer from context, 1-2 sentences, or null",
  "visionStatement": "the brand's long-term ambition or aspiration — extract verbatim or infer, 1-2 sentences, or null",
  "originStory": "how and why the brand was started — brief paragraph, or null",
  "coreValues": [
    { "label": "Value name", "description": "One sentence explaining this value" }
  ],
  "voiceExamples": ["2-4 example sentences or phrases that perfectly demonstrate this brand's voice and tone"],
  "contentDos": ["3-5 content best practices for this brand, e.g. 'Use data-backed claims', 'Lead with customer outcomes'"],
  "bannedWords": ["words or phrases this brand should never use, based on tone/positioning"],
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
  "productsServices": ["specific products or services the brand offers, max 10"],
  "valueProposition": "one sentence describing what makes this brand uniquely valuable, or null",
  "targetMarket": "concise description of the primary target market/customer segment, or null",
  "contentPillars": ["3–6 content themes this brand should consistently post about"],
  "competitors": ["known competitor brand names if mentioned, max 5, empty array if none found"]
}

Rules:
- Use null for string fields and empty arrays for array fields when the value cannot be determined.
- tagline: extract verbatim only; do not invent one.
- brandStage: infer from language — "startup" = early-stage, "growth" = scaling, "established" = mature/long-running.
- coreValues: extract from document if present; infer 2-4 values from the brand's positioning if not explicit.
- voiceExamples: write 2-4 example sentences in the brand's actual voice style — these should feel native to the brand.
- contentDos: practical do's for content creators writing for this brand.
- bannedWords: infer from brand tone — e.g. a premium brand would ban "cheap", "budget", "deal".
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
    maxTokens: 2500,
  });

  return BrandExtractionSchema.parse(extractJsonObject(text));
}
