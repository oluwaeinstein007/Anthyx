import { z } from "zod";
import { generateAIAsset } from "../../services/assets/ai-generator";

export const generateImageAssetTool = {
  name: "generate_image_asset",
  description:
    "Generate an AI image for a post using Gemini Imagen 3. Brand colors are automatically injected into the prompt.",
  inputSchema: z.object({
    prompt: z.string().min(10).max(400),
    brandColors: z.array(z.string()).min(1),
    aspectRatio: z.enum(["1:1", "16:9"]).default("1:1"),
  }),
  async handler({
    prompt,
    brandColors,
    aspectRatio,
  }: {
    prompt: string;
    brandColors: string[];
    aspectRatio: "1:1" | "16:9";
  }) {
    const imageUrl = await generateAIAsset({ prompt, brandColors, aspectRatio });
    return { imageUrl };
  },
};
