import { z } from "zod";
import { retrieveBrandContext } from "../../services/agent/brand-context";
import { db } from "../../db/client";
import { brandProfiles } from "../../db/schema";
import { eq } from "drizzle-orm";

export const retrieveBrandContextTool = {
  name: "retrieve_brand_context",
  description:
    "Retrieve brand voice, tone, and identity information from the brand's memory store. Use this to understand how the brand communicates before generating content or strategy.",
  inputSchema: z.object({
    brandProfileId: z.string().uuid().describe("The brand profile ID to retrieve context for"),
    query: z.string().describe("The query to search brand context with"),
    topK: z.number().int().min(1).max(20).optional().default(10),
  }),
  async handler({
    brandProfileId,
    query,
    topK,
  }: {
    brandProfileId: string;
    query: string;
    topK?: number;
  }) {
    const [context, profile] = await Promise.all([
      retrieveBrandContext(brandProfileId, query, topK ?? 10),
      db.query.brandProfiles.findFirst({ where: eq(brandProfiles.id, brandProfileId) }),
    ]);

    return {
      chunks: context.chunks,
      voiceRules: context.voiceRules,
      voiceTraits: profile?.voiceTraits ?? {},
      colors: [
        ...(profile?.primaryColors ?? []),
        ...(profile?.secondaryColors ?? []),
      ],
      toneDescriptors: profile?.toneDescriptors ?? [],
    };
  },
};
