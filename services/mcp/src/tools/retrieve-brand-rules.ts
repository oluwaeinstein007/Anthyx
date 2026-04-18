import { eq } from "drizzle-orm";
import { db } from "../db";
import { brandProfiles } from "../schema";
import { embed, qdrant } from "../qdrant";

export async function retrieveBrandRules(args: { brandProfileId: string }): Promise<string> {
  const vector = await embed("brand rules voice tone guidelines");

  const [results, profile] = await Promise.all([
    qdrant.search(`brand_${args.brandProfileId}`, {
      vector,
      limit: 12,
      filter: { must: [{ key: "brandProfileId", match: { value: args.brandProfileId } }] },
    }),
    db.query.brandProfiles.findFirst({ where: eq(brandProfiles.id, args.brandProfileId) }),
  ]);

  const rules: string[] = [];

  if (profile?.voiceTraits) {
    const activeTraits = Object.entries(profile.voiceTraits as Record<string, boolean>)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (activeTraits.length > 0) rules.push(`Voice traits: ${activeTraits.join(", ")}`);
  }
  if (profile?.toneDescriptors?.length) rules.push(`Tone: ${profile.toneDescriptors.join(", ")}`);
  if (profile?.primaryColors?.length) rules.push(`Brand colors: ${profile.primaryColors.join(", ")}`);

  const voiceText = results.map((r) => r.payload?.["text"] as string).filter(Boolean).join("\n");
  if (voiceText) rules.push(voiceText);

  return JSON.stringify({
    brandRules: rules.join("\n"),
    rawVoiceChunks: voiceText.split("\n").filter(Boolean),
    profile: { name: profile?.name, industry: profile?.industry, voiceTraits: profile?.voiceTraits, toneDescriptors: profile?.toneDescriptors },
  });
}
