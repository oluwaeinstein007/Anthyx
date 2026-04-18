import { Worker, type Job } from "bullmq";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { redisConnection, contentGenerationQueue } from "../redis.js";
import { marketingPlans, scheduledPosts } from "../schema.js";
import { runStrategistAgent } from "../strategist.js";
import type { GeneratedPlanItem } from "@anthyx/types";

interface PlanJobData {
  planId: string;
  organizationId: string;
  brandProfileId: string;
  brandName: string;
  industry: string;
  goals: string[];
  platforms: string[];
  agentId: string;
  socialAccountIds: string[];
  feedbackLoopEnabled?: boolean;
}

const worker = new Worker<PlanJobData>(
  "anthyx-plan-generation",
  async (job: Job<PlanJobData>) => {
    const { planId, organizationId, brandProfileId, brandName, industry, goals, platforms, agentId, socialAccountIds, feedbackLoopEnabled } = job.data;

    console.log(`[PlanWorker] Generating plan ${planId}`);

    const plan = await db.query.marketingPlans.findFirst({ where: eq(marketingPlans.id, planId) });
    if (!plan) throw new Error(`Plan ${planId} not found`);

    const planItems = await runStrategistAgent({
      organizationId,
      brandProfileId,
      brandName,
      industry,
      goals,
      platforms,
      startDate: plan.startDate.toISOString(),
      feedbackLoopEnabled,
    });

    for (const item of planItems as GeneratedPlanItem[]) {
      const accountIndex = platforms.indexOf(item.platform);
      const socialAccountId = socialAccountIds[accountIndex] ?? socialAccountIds[0];
      if (!socialAccountId) continue;

      await db.insert(scheduledPosts).values({
        planId,
        socialAccountId,
        agentId,
        organizationId,
        brandProfileId,
        platform: item.platform,
        contentText: item.topic,
        contentType: item.contentType,
        scheduledAt: new Date(item.date),
        status: "draft",
        suggestedMediaPrompt: item.suggestVisual ? item.notes ?? item.topic : null,
        assetTrack: item.suggestVisual ? "template" : undefined,
      });
    }

    await db.update(marketingPlans).set({ status: "pending_review", updatedAt: new Date() }).where(eq(marketingPlans.id, planId));
    await contentGenerationQueue.add("generate-content", { planId, organizationId });

    console.log(`[PlanWorker] Plan ${planId} generated ${planItems.length} items`);
  },
  { connection: redisConnection, concurrency: 2 },
);

worker.on("failed", async (job, err) => {
  if (job) {
    await db.update(marketingPlans).set({ status: "paused", updatedAt: new Date() }).where(eq(marketingPlans.id, job.data.planId));
  }
  console.error(`[PlanWorker] Job ${job?.id} failed:`, err);
});

export { worker as planWorker };
