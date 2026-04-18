import { GoogleGenerativeAI } from "@google/generative-ai";
import { QdrantClient } from "@qdrant/js-client-rest";

const genAI = new GoogleGenerativeAI(process.env["GEMINI_API_KEY"] ?? "");
const EMBEDDING_MODEL = process.env["GEMINI_EMBEDDING_MODEL"] ?? "text-embedding-004";

const qdrant = new QdrantClient({
  url: process.env["QDRANT_URL"] ?? "http://localhost:6333",
  apiKey: process.env["QDRANT_API_KEY"],
});

async function embed(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
  const result = await model.embedContent({ content: { role: "user", parts: [{ text }] } });
  return result.embedding.values;
}

export async function retrieveBrandVoiceFromQdrant(brandProfileId: string, query: string, topK = 8): Promise<string> {
  const vector = await embed(query);

  const results = await qdrant.search(`brand_${brandProfileId}`, {
    vector,
    limit: topK,
    filter: {
      must: [
        { key: "brandProfileId", match: { value: brandProfileId } },
        { key: "type", match: { any: ["voice_rule", "tone_descriptor", "brand_statement"] } },
      ],
    },
  });

  return results
    .map((r) => r.payload?.["text"] as string | undefined)
    .filter(Boolean)
    .join("\n");
}
