/**
 * Seeds the plan_tiers table with all tier configurations.
 * Run once on first deploy: npx tsx src/db/seed.ts
 */
import { db } from "./client";
import { planTiers } from "./schema";
import { PLAN_TIER_CONFIGS } from "@anthyx/types";

async function seed() {
  console.log("Seeding plan_tiers...");

  for (const config of Object.values(PLAN_TIER_CONFIGS)) {
    await db
      .insert(planTiers)
      .values({
        tier: config.tier,
        displayName: config.displayName,
        monthlyPrice: config.monthlyPrice < 0 ? 0 : config.monthlyPrice,
        annualPrice: config.annualPrice < 0 ? 0 : config.annualPrice,
        maxBrands: config.maxBrands,
        maxAgents: config.maxAgents,
        maxSocialAccounts: config.maxSocialAccounts,
        maxPostsPerMonth: config.maxPostsPerMonth,
        autonomousScheduling: config.features.autonomousScheduling,
        feedbackLoop: config.features.feedbackLoop,
        aiAssetGeneration: config.features.aiAssetGeneration,
        ipRotation: config.features.ipRotation,
        whiteLabel: config.features.whiteLabel,
        assetWatermark: config.features.assetWatermark,
        hitlRequired: config.features.hitlRequired,
        guardrails: config.features.guardrails,
        agentSilence: config.features.agentSilence,
        rbac: config.features.rbac,
        overagePricePerPost: config.overagePricePerPost,
        overagePricePerAccount: config.overagePricePerAccount,
        overagePricePerBrand: config.overagePricePerBrand,
      })
      .onConflictDoUpdate({
        target: planTiers.tier,
        set: {
          displayName: config.displayName,
          monthlyPrice: config.monthlyPrice < 0 ? 0 : config.monthlyPrice,
          annualPrice: config.annualPrice < 0 ? 0 : config.annualPrice,
        },
      });
  }

  console.log("plan_tiers seeded successfully.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
