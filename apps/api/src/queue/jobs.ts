import { eq } from "drizzle-orm";
import {
  postExecutionQueue,
  planGenerationQueue,
  contentGenerationQueue,
  analyticsQueue,
} from "./client";
import { db } from "../db/client";
import { scheduledPosts } from "../db/schema";
import { productConfig } from "@anthyx/config";

/**
 * Schedule a post for execution with ±3 minute random jitter
 * to avoid machine-precision interval detection by social platforms.
 */
export async function schedulePostJob(postId: string, scheduledAt: Date): Promise<string> {
  // Add ±3 minute random jitter
  const jitterMs = (Math.random() * 6 - 3) * 60 * 1000;
  const jitteredTime = new Date(scheduledAt.getTime() + jitterMs);
  const delay = jitteredTime.getTime() - Date.now();

  if (delay < 0) throw new Error("Cannot schedule post in the past");

  const job = await postExecutionQueue.add(
    "execute-post",
    { postId },
    {
      delay,
      attempts: productConfig.postJobRetryAttempts,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { age: 86400 },
      removeOnFail: { age: 604800 },
    },
  );

  await db
    .update(scheduledPosts)
    .set({ bullJobId: job.id, status: "scheduled" })
    .where(eq(scheduledPosts.id, postId));

  return job.id!;
}

export async function queuePlanGeneration(planId: string, organizationId: string): Promise<void> {
  await planGenerationQueue.add("generate-plan", { planId, organizationId });
}

export async function queueContentGeneration(planId: string, organizationId: string): Promise<void> {
  await contentGenerationQueue.add("generate-content", { planId, organizationId });
}

export async function queueAnalyticsFetch(postId: string): Promise<void> {
  await analyticsQueue.add(
    "fetch-analytics",
    { postId },
    { delay: 30 * 60 * 1000 }, // 30 minutes after publish
  );
}
