import { Worker, type Job } from "bullmq";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { scheduledPosts, postAnalytics } from "../db/schema";
import { redisConnection } from "../queue/client";
import { oauthProxy } from "../services/oauth-proxy";
import { fetchEngagementData } from "../services/posting/social-mcp";
import type { Platform } from "@anthyx/types";

interface AnalyticsJobData {
  postId: string;
}

const worker = new Worker<AnalyticsJobData>(
  "anthyx-analytics",
  async (job: Job<AnalyticsJobData>) => {
    const { postId } = job.data;

    const post = await db.query.scheduledPosts.findFirst({
      where: eq(scheduledPosts.id, postId),
    });

    if (!post?.platformPostId) return;

    try {
      const token = await oauthProxy.getValidToken(post.socialAccountId);
      const metrics = await fetchEngagementData(
        post.platform as Platform,
        post.platformPostId,
        token,
      );

      const engagementRate =
        metrics.impressions > 0
          ? (
              (metrics.likes + metrics.comments + metrics.reposts) /
              metrics.impressions
            ).toFixed(6)
          : "0";

      await db.insert(postAnalytics).values({
        postId,
        likes: metrics.likes,
        reposts: metrics.reposts,
        comments: metrics.comments,
        impressions: metrics.impressions,
        clicks: metrics.clicks,
        engagementRate,
        rawData: metrics.raw,
      });

      console.log(`[AnalyticsWorker] Stored analytics for post ${postId}, rate: ${engagementRate}`);
    } catch (err) {
      console.error(`[AnalyticsWorker] Failed to fetch analytics for post ${postId}:`, err);
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,
  },
);

worker.on("error", (err) => console.error("[AnalyticsWorker] Error:", err));

export { worker as analyticsWorker };
