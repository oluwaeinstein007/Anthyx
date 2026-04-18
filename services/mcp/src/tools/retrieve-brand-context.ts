import { eq } from "drizzle-orm";
import { db } from "../db";
import { brandProfiles } from "../schema";
import { embed, qdrant } from "../qdrant";

export async function retrieveBrandContext(args: {
  brandProfileId: string;
  query: string;
  topK: number;
}): Promise<string> {
  const vector = await embed(args.query);

  const [results, profile] = await Promise.all([
    qdrant.search(`brand_${args.brandProfileId}`, {
      vector,
      limit: args.topK,
      filter: { must: [{ key: "brandProfileId", match: { value: args.brandProfileId } }] },
    }),
    db.query.brandProfiles.findFirst({ where: eq(brandProfiles.id, args.brandProfileId) }),
  ]);

  const chunks = results
    .map((r) => r.payload?.["text"] as string | undefined)
    .filter(Boolean) as string[];

  const voiceRules = results
    .filter((r) => ["voice_rule", "tone_descriptor", "brand_statement"].includes((r.payload?.["type"] as string) ?? ""))
    .map((r) => r.payload?.["text"] as string)
    .filter(Boolean);

  return JSON.stringify({
    chunks,
    voiceRules,
    voiceTraits: profile?.voiceTraits ?? {},
    colors: [...(profile?.primaryColors ?? []), ...(profile?.secondaryColors ?? [])],
    toneDescriptors: profile?.toneDescriptors ?? [],
  });
}
