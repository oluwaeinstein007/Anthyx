import { GoogleGenAI } from "@google/genai";
import { uploadBufferToCDN } from "./cdn";

let _genai: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!_genai) _genai = new GoogleGenAI({ apiKey: process.env["GEMINI_API_KEY"]! });
  return _genai;
}

export async function generateAIAsset(params: {
  prompt: string;
  brandColors: string[];
  aspectRatio?: "1:1" | "16:9";
}): Promise<string> {
  const primaryColor = params.brandColors[0] ?? "#000000";
  const accentColor = params.brandColors[1] ?? primaryColor;

  const fullPrompt = `${params.prompt}. Primary brand color: ${primaryColor}, accent: ${accentColor}. Professional digital marketing visual. Clean, modern aesthetic. No text overlay.`;

  const response = await getGenAI().models.generateImages({
    model: process.env["GEMINI_IMAGE_MODEL"] ?? "imagen-3.0-generate-002",
    prompt: fullPrompt,
    config: {
      numberOfImages: 1,
      aspectRatio: params.aspectRatio === "16:9" ? "16:9" : "1:1",
      outputMimeType: "image/jpeg",
    },
  });

  const imageBytes = response.generatedImages?.[0]?.image?.imageBytes;
  if (!imageBytes) throw new Error("Gemini returned no image");

  const buffer = Buffer.from(imageBytes, "base64");
  return uploadBufferToCDN(buffer, "image/jpeg");
}
