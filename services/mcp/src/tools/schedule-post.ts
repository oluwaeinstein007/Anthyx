import { eq } from "drizzle-orm";
import { db } from "../db";
import { scheduledPosts } from "../schema";
import { postExecutionQueue } from "../redis";
import { productConfig } from "@anthyx/config";

export async function schedulePost(args: {
  postId: string;
  scheduledAt: string;
}): Promise<string> {
  const date = new Date(args.scheduledAt);
  const jitterMs = (Math.random() * 6 - 3) * 60 * 1000;
  const jitteredTime = new Date(date.getTime() + jitterMs);
  const delay = jitteredTime.getTime() - Date.now();

  if (delay < 0) throw new Error("Cannot schedule post in the past");

  const job = await postExecutionQueue.add(
    "execute-post",
    { postId: args.postId },
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
    .where(eq(scheduledPosts.id, args.postId));

  return JSON.stringify({ jobId: job.id, scheduledAt: jitteredTime.toISOString() });
}
