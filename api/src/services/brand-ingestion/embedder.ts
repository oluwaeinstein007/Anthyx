import { GoogleGenerativeAI } from "@google/generative-ai";
import { QdrantClient } from "@qdrant/js-client-rest";
import type { BrandExtraction } from "@anthyx/config";

const genAI = new GoogleGenerativeAI(process.env["GEMINI_API_KEY"] ?? "");
const qdrant = new QdrantClient({
  url: process.env["QDRANT_URL"] ?? "http://localhost:6333",
  apiKey: process.env["QDRANT_API_KEY"],
});

const EMBEDDING_MODEL = process.env["GEMINI_EMBEDDING_MODEL"] ?? "gemini-embedding-001";
const VECTOR_SIZE = parseInt(process.env["GEMINI_EMBEDDING_VECTOR_SIZE"] ?? "3072", 10);

export interface ChunkMetadata {
  type: "voice_rule" | "tone_descriptor" | "color_reference" | "brand_statement" | "audience_note";
  source: string;
  organizationId: string;
  brandProfileId: string;
}

// Split text into ~500 word chunks with 50 word overlap
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
    const info = await qdrant.getCollection(collectionName);
    const existingSize = (info.config?.params?.vectors as { size?: number } | undefined)?.size;
    if (existingSize !== undefined && existingSize !== VECTOR_SIZE) {
      await qdrant.deleteCollection(collectionName);
      throw new Error("dimension mismatch — recreating");
    }
  } catch {
    await qdrant.createCollection(collectionName, {
      vectors: { size: VECTOR_SIZE, distance: "Cosine" },
    });
  }
}

export async function embedAndStore(
  chunks: string[],
  metadata: ChunkMetadata,
): Promise<void> {
  if (chunks.length === 0) return;

  // Batch embeddings (max 100 at a time)
  const BATCH_SIZE = 100;
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const embeddingModel = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
    const { embeddings } = await embeddingModel.batchEmbedContents({
      requests: batch.map((text) => ({
        content: { role: "user", parts: [{ text }] },
      })),
    });

    const points = embeddings.map((e, idx) => ({
      id: crypto.randomUUID(),
      vector: e.values,
      payload: {
        text: batch[idx],
        ...metadata,
      },
    }));

    await qdrant.upsert(`brand_${metadata.brandProfileId}`, { points });
  }
}

export async function embed(text: string, retries = 3): Promise<number[]> {
  const embeddingModel = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const result = await embeddingModel.embedContent({
        content: { role: "user", parts: [{ text }] },
      });
      return result.embedding.values;
    } catch (err) {
      lastError = err;
      if (attempt < retries - 1) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt)); // 1s, 2s backoff
      }
    }
  }
  throw lastError;
}

/**
 * Hash a string to a stable 8-char hex fingerprint for change detection.
 * Used by the incremental re-ingest to skip unchanged chunks.
 */
function fingerprint(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h) ^ text.charCodeAt(i);
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * Incremental re-ingest: only re-embeds chunks that changed and tombstones removed ones.
 * Compares incoming chunks to what is already stored in Qdrant for this source.
 * Falls back to a full ingest if no existing points are found.
 */
export async function incrementalIngestBrandDocument(
  text: string,
  brandProfileId: string,
  organizationId: string,
  sourceName: string,
  extraction: BrandExtraction,
): Promise<{ added: number; unchanged: number; removed: number }> {
  await ensureQdrantCollection(brandProfileId);
  const collectionName = `brand_${brandProfileId}`;

  // 1. Fetch existing points for this source from Qdrant
  const { points: existing } = await qdrant.scroll(collectionName, {
    filter: {
      must: [
        { key: "brandProfileId", match: { value: brandProfileId } },
        { key: "source", match: { value: sourceName } },
      ],
    },
    limit: 2000,
    with_payload: true,
    with_vector: false,
  });

  // Build fingerprint → pointId map for existing chunks
  const existingMap = new Map<string, string>();
  for (const p of existing) {
    const fp = p.payload?.["fingerprint"] as string | undefined;
    if (fp) existingMap.set(fp, String(p.id));
  }

  const incomingChunks = chunkText(text);
  const incomingFps = new Set<string>();

  let added = 0;
  const chunksToEmbed: string[] = [];

  for (const chunk of incomingChunks) {
    const fp = fingerprint(chunk);
    incomingFps.add(fp);
    if (!existingMap.has(fp)) {
      chunksToEmbed.push(chunk);
    }
  }

  // 2. Embed and store new/changed chunks with fingerprint in payload
  if (chunksToEmbed.length > 0) {
    const BATCH_SIZE = 100;
    const embeddingModel = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
    for (let i = 0; i < chunksToEmbed.length; i += BATCH_SIZE) {
      const batch = chunksToEmbed.slice(i, i + BATCH_SIZE);
      const { embeddings } = await embeddingModel.batchEmbedContents({
        requests: batch.map((t) => ({ content: { role: "user", parts: [{ text: t }] } })),
      });
      const points = embeddings.map((e, idx) => ({
        id: crypto.randomUUID(),
        vector: e.values,
        payload: {
          text: batch[idx],
          fingerprint: fingerprint(batch[idx]!),
          type: "brand_statement" as const,
          source: sourceName,
          organizationId,
          brandProfileId,
        },
      }));
      await qdrant.upsert(collectionName, { points });
      added += points.length;
    }
  }

  // 3. Tombstone (delete) points whose fingerprint is no longer in the incoming set
  const toDelete = [...existingMap.entries()]
    .filter(([fp]) => !incomingFps.has(fp))
    .map(([, id]) => id);

  let removed = 0;
  if (toDelete.length > 0) {
    await qdrant.delete(collectionName, { points: toDelete });
    removed = toDelete.length;
  }

  // 4. Full re-embed voice/tone/audience structured fields (small, always fresh)
  await ingestBrandDocument(text, brandProfileId, organizationId, `${sourceName}:structured`, extraction);

  return { added, unchanged: incomingChunks.length - chunksToEmbed.length, removed };
}

export async function ingestBrandDocument(
  text: string,
  brandProfileId: string,
  organizationId: string,
  sourceName: string,
  extraction: BrandExtraction,
): Promise<void> {
  await ensureQdrantCollection(brandProfileId);

  // 1. Embed raw text chunks as generic brand statements
  const textChunks = chunkText(text);
  await embedAndStore(textChunks, {
    type: "brand_statement",
    source: sourceName,
    organizationId,
    brandProfileId,
  });

  // 2. Embed extracted voice rules
  const voiceChunks = Object.entries(extraction.voiceTraits)
    .filter(([, v]) => v === true)
    .map(([trait]) => `Brand voice trait: ${trait}`);
  if (voiceChunks.length > 0) {
    await embedAndStore(voiceChunks, {
      type: "voice_rule",
      source: "extracted",
      organizationId,
      brandProfileId,
    });
  }

  // 3. Embed tone descriptors
  if (extraction.toneDescriptors.length > 0) {
    await embedAndStore(
      extraction.toneDescriptors.map((t) => `Tone descriptor: ${t}`),
      {
        type: "tone_descriptor",
        source: "extracted",
        organizationId,
        brandProfileId,
      },
    );
  }

  // 4. Embed brand statements
  if (extraction.brandStatements.length > 0) {
    await embedAndStore(extraction.brandStatements, {
      type: "brand_statement",
      source: "extracted",
      organizationId,
      brandProfileId,
    });
  }

  // 5. Embed audience notes
  if (extraction.audienceNotes.length > 0) {
    await embedAndStore(extraction.audienceNotes, {
      type: "audience_note",
      source: "extracted",
      organizationId,
      brandProfileId,
    });
  }

  // 6. Embed color references
  const allColors = [...extraction.primaryColors, ...extraction.secondaryColors];
  if (allColors.length > 0) {
    await embedAndStore(allColors.map((c) => `Brand color: ${c}`), {
      type: "color_reference",
      source: "extracted",
      organizationId,
      brandProfileId,
    });
  }

  // 7. Embed products/services
  if (extraction.productsServices && extraction.productsServices.length > 0) {
    await embedAndStore(
      extraction.productsServices.map((p) => `Product or service offered: ${p}`),
      { type: "brand_statement", source: "extracted", organizationId, brandProfileId },
    );
  }

  // 8. Embed value proposition
  if (extraction.valueProposition) {
    await embedAndStore(
      [`Value proposition: ${extraction.valueProposition}`],
      { type: "brand_statement", source: "extracted", organizationId, brandProfileId },
    );
  }

  // 9. Embed target market
  if (extraction.targetMarket) {
    await embedAndStore(
      [`Target market: ${extraction.targetMarket}`],
      { type: "audience_note", source: "extracted", organizationId, brandProfileId },
    );
  }

  // 10. Embed content pillars
  if (extraction.contentPillars && extraction.contentPillars.length > 0) {
    await embedAndStore(
      extraction.contentPillars.map((p) => `Content pillar: ${p}`),
      { type: "brand_statement", source: "extracted", organizationId, brandProfileId },
    );
  }
}
