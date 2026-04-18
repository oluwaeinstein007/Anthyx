import { z } from "zod";
import { retrieveBrandVoiceFromQdrant } from "../../services/agent/brand-context";

export const retrieveBrandVoiceTool = {
  name: "retrieve_brand_voice",
  description:
    "Retrieve targeted brand voice and tone rules relevant to a specific topic. Use this before writing post content to ensure brand consistency.",
  inputSchema: z.object({
    brandProfileId: z.string().uuid(),
    topic: z.string().describe("The topic of the post being written"),
  }),
  async handler({ brandProfileId, topic }: { brandProfileId: string; topic: string }) {
    const voiceText = await retrieveBrandVoiceFromQdrant(brandProfileId, topic, 8);
    return {
      voiceRules: voiceText.split("\n").filter(Boolean),
      rawText: voiceText,
    };
  },
};
