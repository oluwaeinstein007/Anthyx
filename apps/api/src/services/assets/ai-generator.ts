import OpenAI from "openai";
import { uploadToCDN } from "./cdn";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env["OPENAI_API_KEY"] });
  return _openai;
}

export async function generateAIAsset(params: {
  prompt: string;
  brandColors: string[];
  aspectRatio?: "1:1" | "16:9";
}): Promise<string> {
  const primaryColor = params.brandColors[0] ?? "#000000";
  const accentColor = params.brandColors[1] ?? primaryColor;

  const fullPrompt = `${params.prompt}. Primary brand color: ${primaryColor}, accent: ${accentColor}. Professional digital marketing visual. Clean, modern aesthetic. No text overlay.`;

  const response = await getOpenAI().images.generate({
    model: process.env["DALLE_MODEL"] ?? "dall-e-3",
    prompt: fullPrompt,
    size: params.aspectRatio === "16:9" ? "1792x1024" : "1024x1024",
    quality: "standard",
    n: 1,
  });

  const imageUrl = response.data[0]?.url;
  if (!imageUrl) throw new Error("DALL-E returned no image URL");

  return uploadToCDN(imageUrl);
}
