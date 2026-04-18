import { GoogleGenerativeAI } from "@google/generative-ai";
import { QdrantClient } from "@qdrant/js-client-rest";
import type { BrandExtraction } from "@anthyx/config";

const genAI = new GoogleGenerativeAI(process.env["GEMINI_API_KEY"] ?? "");
const qdrant = new QdrantClient({
  url: process.env["QDRANT_URL"] ?? "http://localhost:6333",
  apiKey: process.env["QDRANT_API_KEY"],
});

const VECTOR_SIZE = 768;
const EMBEDDING_MODEL = process.env["GEMINI_EMBEDDING_MODEL"] ?? "text-embedding-004";

export interface ChunkMetadata {
  type: "voice_rule" | "tone_descriptor" | "color_reference" | "brand_statement" | "audience_note";
  source: string;
  organizationId: string;
  brandProfileId: string;
}

export function chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let i = 0;
  while (i < words.length) {
    chunks.push(words.slice(i, i + chunkSize).join(" "));
    i += chunkSize - overlap;
  }
  return chunks;
}

export async function ensureQdrantCollection(brandProfileId: string): Promise<void> {
  const collectionName = `brand_${brandProfileId}`;
  try {
    await qdrant.getCollection(collectionName);
  } catch {
    await qdrant.createCollection(collectionName, { vectors: { size: VECTOR_SIZE, distance: "Cosine" } });
  }
}

export async function embedAndStore(chunks: string[], metadata: ChunkMetadata): Promise<void> {
  if (chunks.length === 0) return;

  const BATCH_SIZE = 100;
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const embeddingModel = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
    const { embeddings } = await embeddingModel.batchEmbedContents({
      requests: batch.map((text) => ({ content: { role: "user", parts: [{ text }] } })),
    });

    const points = embeddings.map((e, idx) => ({
      id: crypto.randomUUID(),
      vector: e.values,
      payload: { text: batch[idx], ...metadata },
    }));

    await qdrant.upsert(`brand_${metadata.brandProfileId}`, { points });
  }
}

export async function ingestBrandDocument(
  text: string,
  brandProfileId: string,
  organizationId: string,
  sourceName: string,
  extraction: BrandExtraction,
): Promise<void> {
  await ensureQdrantCollection(brandProfileId);

  await embedAndStore(chunkText(text), { type: "brand_statement", source: sourceName, organizationId, brandProfileId });

  const voiceChunks = Object.entries(extraction.voiceTraits)
    .filter(([, v]) => v === true)
    .map(([trait]) => `Brand voice trait: ${trait}`);
  if (voiceChunks.length > 0)
    await embedAndStore(voiceChunks, { type: "voice_rule", source: "extracted", organizationId, brandProfileId });

  if (extraction.toneDescriptors.length > 0)
    await embedAndStore(
      extraction.toneDescriptors.map((t) => `Tone descriptor: ${t}`),
      { type: "tone_descriptor", source: "extracted", organizationId, brandProfileId },
    );

  if (extraction.brandStatements.length > 0)
    await embedAndStore(extraction.brandStatements, { type: "brand_statement", source: "extracted", organizationId, brandProfileId });

  if (extraction.audienceNotes.length > 0)
    await embedAndStore(extraction.audienceNotes, { type: "audience_note", source: "extracted", organizationId, brandProfileId });

  const allColors = [...extraction.primaryColors, ...extraction.secondaryColors];
  if (allColors.length > 0)
    await embedAndStore(
      allColors.map((c) => `Brand color: ${c}`),
      { type: "color_reference", source: "extracted", organizationId, brandProfileId },
    );
}
