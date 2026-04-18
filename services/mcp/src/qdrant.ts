import { QdrantClient } from "@qdrant/js-client-rest";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const qdrant = new QdrantClient({
  url: process.env["QDRANT_URL"] ?? "http://localhost:6333",
  apiKey: process.env["QDRANT_API_KEY"],
});

const genai = new GoogleGenerativeAI(process.env["GEMINI_API_KEY"] ?? "");

export async function embed(text: string): Promise<number[]> {
  const model = genai.getGenerativeModel({
    model: process.env["GEMINI_EMBEDDING_MODEL"] ?? "text-embedding-004",
  });
  const result = await model.embedContent({
    content: { role: "user", parts: [{ text }] },
  });
  return result.embedding.values;
}
