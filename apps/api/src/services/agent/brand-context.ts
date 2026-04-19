import { QdrantClient } from "@qdrant/js-client-rest";
import { embed } from "../brand-ingestion/embedder";

const qdrant = new QdrantClient({
  url: process.env["QDRANT_URL"] ?? "http://localhost:6333",
  apiKey: process.env["QDRANT_API_KEY"],
});

/**
 * Retrieve brand voice/tone chunks from Qdrant.
 * ALWAYS filtered by brandProfileId — no cross-tenant leakage.
 */
export async function retrieveBrandVoiceFromQdrant(
  brandProfileId: string,
  query: string,
  topK = 8,
): Promise<string> {
  let vector: number[];
  try {
    vector = await embed(query);
  } catch (err) {
    console.warn(`[BrandContext] Embedding failed, proceeding without brand voice: ${err}`);
    return "";
  }

  const results = await qdrant.search(`brand_${brandProfileId}`, {
    vector,
    limit: topK,
    filter: {
      must: [
        { key: "brandProfileId", match: { value: brandProfileId } }, // TENANT ISOLATION
        {
          key: "type",
          match: { any: ["voice_rule", "tone_descriptor", "brand_statement"] },
        },
      ],
    },
  });

  return results
    .map((r) => r.payload?.["text"] as string | undefined)
    .filter(Boolean)
    .join("\n");
}

/**
 * Full brand context retrieval — voice + colors.
 */
export async function retrieveBrandContext(
  brandProfileId: string,
  query: string,
  topK = 10,
): Promise<{ chunks: string[]; voiceRules: string[] }> {
  const vector = await embed(query);

  const results = await qdrant.search(`brand_${brandProfileId}`, {
    vector,
    limit: topK,
    filter: {
      must: [{ key: "brandProfileId", match: { value: brandProfileId } }],
    },
  });

  const chunks = results
    .map((r) => r.payload?.["text"] as string | undefined)
    .filter(Boolean) as string[];

  const voiceRules = results
    .filter((r) =>
      ["voice_rule", "tone_descriptor", "brand_statement"].includes(
        (r.payload?.["type"] as string) ?? "",
      ),
    )
    .map((r) => r.payload?.["text"] as string)
    .filter(Boolean);

  return { chunks, voiceRules };
}
