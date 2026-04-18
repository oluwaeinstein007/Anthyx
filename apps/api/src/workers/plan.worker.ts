import { Worker, type Job } from "bullmq";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { marketingPlans, scheduledPosts } from "../db/schema";
import { redisConnection } from "../queue/client";
import { runStrategistAgent } from "../services/agent/strategist";
import { queueContentGeneration, type PlanJobData } from "../queue/jobs";
import type { GeneratedPlanItem } from "@anthyx/types";

const worker = new Worker<PlanJobData>(
  "anthyx-plan-generation",
  async (job: Job<PlanJobData>) => {
    const {
      planId,
      organizationId,
      brandProfileId,
      brandName,
      industry,
      goals,
      platforms,
      agentId,
      socialAccountIds,
      durationDays,
      feedbackLoopEnabled,
    } = job.data;

    console.log(`[PlanWorker] Generating plan ${planId}`);

    const plan = await db.query.marketingPlans.findFirst({
      where: eq(marketingPlans.id, planId),
    });

    if (!plan) throw new Error(`Plan ${planId} not found`);

    // Run the Strategist Agent
    const planItems = await runStrategistAgent({
      organizationId,
      brandProfileId,
      brandName,
      industry,
      goals,
      platforms,
      startDate: plan.startDate.toISOString(),
      durationDays: durationDays ?? 30,
      feedbackLoopEnabled,
    });

    if (planItems.length === 0) {
      throw new Error("Strategist agent returned no plan items — brand may need ingestion first");
    }

    // Create ScheduledPost rows (status: 'draft') for each plan item
    for (const item of planItems) {
      const accountIndex = platforms.indexOf(item.platform);
      const socialAccountId = socialAccountIds[accountIndex] ?? socialAccountIds[0] ?? null;

      await db.insert(scheduledPosts).values({
        planId,
        socialAccountId,
        agentId,
        organizationId,
        brandProfileId,
        platform: item.platform,
        contentText: item.topic, // draft holds the topic; Copywriter replaces with full content
        contentType: item.contentType,
        scheduledAt: new Date(item.date),
        status: "draft",
        suggestedMediaPrompt: item.suggestVisual ? item.notes ?? item.topic : null,
        assetTrack: item.suggestVisual ? "template" : undefined,
      });
    }

    // Update plan status
    await db
      .update(marketingPlans)
      .set({ status: "pending_review", updatedAt: new Date() })
      .where(eq(marketingPlans.id, planId));

    // Trigger content generation for all draft posts
    await queueContentGeneration(planId, organizationId);

    console.log(`[PlanWorker] Plan ${planId} generated ${planItems.length} items`);
  },
  {
    connection: redisConnection,
    concurrency: 2,
  },
);

worker.on("failed", async (job, err) => {
  if (job) {
    await db
      .update(marketingPlans)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(marketingPlans.id, job.data.planId));
  }
  console.error(`[PlanWorker] Job ${job?.id} failed:`, err);
});

export { worker as planWorker };
