import { z } from "zod";
import { retrieveBrandVoiceFromQdrant } from "../../services/agent/brand-context";
import { db } from "../../db/client";
import { brandProfiles } from "../../db/schema";
import { eq } from "drizzle-orm";

export const retrieveBrandRulesTool = {
  name: "retrieve_brand_rules",
  description:
    "Retrieve the comprehensive brand rules including voice, tone, and identity constraints. Used by the Reviewer agent for compliance checking.",
  inputSchema: z.object({
    brandProfileId: z.string().uuid(),
  }),
  async handler({ brandProfileId }: { brandProfileId: string }) {
    const [voiceText, profile] = await Promise.all([
      retrieveBrandVoiceFromQdrant(brandProfileId, "brand rules voice tone guidelines", 12),
      db.query.brandProfiles.findFirst({ where: eq(brandProfiles.id, brandProfileId) }),
    ]);

    const rules: string[] = [];

    if (profile?.voiceTraits) {
      const activeTraits = Object.entries(profile.voiceTraits as Record<string, boolean>)
        .filter(([, v]) => v)
        .map(([k]) => k);
      if (activeTraits.length > 0) {
        rules.push(`Voice traits: ${activeTraits.join(", ")}`);
      }
    }

    if (profile?.toneDescriptors && profile.toneDescriptors.length > 0) {
      rules.push(`Tone: ${profile.toneDescriptors.join(", ")}`);
    }

    if (profile?.primaryColors && profile.primaryColors.length > 0) {
      rules.push(`Brand colors: ${profile.primaryColors.join(", ")}`);
    }

    if (voiceText) {
      rules.push(voiceText);
    }

    return {
      brandRules: rules.join("\n"),
      rawVoiceChunks: voiceText.split("\n").filter(Boolean),
      profile: {
        name: profile?.name,
        industry: profile?.industry,
        voiceTraits: profile?.voiceTraits,
        toneDescriptors: profile?.toneDescriptors,
      },
    };
  },
};
