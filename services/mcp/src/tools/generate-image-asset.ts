import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env["OPENAI_API_KEY"] });

export async function generateImageAsset(args: {
  prompt: string;
  brandColors: string[];
  aspectRatio: "1:1" | "16:9";
}): Promise<string> {
  const primaryColor = args.brandColors[0] ?? "#000000";
  const accentColor = args.brandColors[1] ?? primaryColor;

  const fullPrompt = `${args.prompt}. Primary brand color: ${primaryColor}, accent: ${accentColor}. Professional digital marketing visual. Clean, modern aesthetic. No text overlay.`;

  const response = await openai.images.generate({
    model: process.env["DALLE_MODEL"] ?? "dall-e-3",
    prompt: fullPrompt,
    size: args.aspectRatio === "16:9" ? "1792x1024" : "1024x1024",
    quality: "standard",
    n: 1,
  });

  const imageUrl = response.data[0]?.url;
  if (!imageUrl) throw new Error("DALL-E returned no image URL");

  return JSON.stringify({ imageUrl });
}
