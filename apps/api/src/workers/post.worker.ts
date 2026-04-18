import { Worker, type Job } from "bullmq";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { scheduledPosts, agents, brandProfiles } from "../db/schema";
import { redisConnection } from "../queue/client";
import { queueAnalyticsFetch } from "../queue/jobs";
import { oauthProxy } from "../services/oauth-proxy";
import { publishToplatform } from "../services/posting/executor";
import { generateAssetForPost } from "../services/assets/generator";
import { getActiveGuardrails } from "../services/agent/guardrails";
import { logAgentAction } from "../services/agent/logger";
import { incrementPost } from "../services/billing/usage-tracker";
import type { Platform } from "@anthyx/types";
import { productConfig } from "@anthyx/config";

interface PostJobData {
  postId: string;
}

const worker = new Worker<PostJobData>(
  "anthyx-post-execution",
  async (job: Job<PostJobData>) => {
    const { postId } = job.data;

    const post = await db.query.scheduledPosts.findFirst({
      where: eq(scheduledPosts.id, postId),
    });

    if (!post) throw new Error(`Post ${postId} not found`);

    // Rule 19: HITL re-check at worker layer
    if (post.status !== "approved") {
      console.log(`[PostWorker] Post ${postId} is not approved (status: ${post.status}). Skipping.`);
      return;
    }

    // Rule 20: Check agent is still active
    const agent = await db.query.agents.findFirst({
      where: eq(agents.id, post.agentId),
    });

    if (!agent?.isActive) {
      await db
        .update(scheduledPosts)
        .set({ status: "silenced", updatedAt: new Date() })
        .where(eq(scheduledPosts.id, postId));
      return;
    }

    // Rule 12: Check for active blackouts at execution time
    const guardrails = await getActiveGuardrails(post.organizationId);
    if (guardrails.activeBlackouts.length > 0) {
      await db
        .update(scheduledPosts)
        .set({
          status: "vetoed",
          reviewNotes: `Blackout period: ${guardrails.activeBlackouts.join(", ")}`,
          updatedAt: new Date(),
        })
        .where(eq(scheduledPosts.id, postId));
      return;
    }

    // Generate image asset if needed
    let mediaUrls = post.mediaUrls ?? [];
    if (post.suggestedMediaPrompt || post.contentText.includes("[GENERATE_IMAGE]")) {
      const brand = await db.query.brandProfiles.findFirst({
        where: eq(brandProfiles.id, post.brandProfileId),
      });

      const assetUrl = await generateAssetForPost({
        contentText: post.contentText,
        suggestedMediaPrompt: post.suggestedMediaPrompt,
        assetTrack: (post.assetTrack as "template" | "ai") ?? "template",
        brandPrimaryColors: brand?.primaryColors ?? undefined,
        brandSecondaryColors: brand?.secondaryColors ?? undefined,
        bannerBearTemplateUid: brand?.bannerBearTemplateUid,
        logoUrl: brand?.logoUrl,
        platform: post.platform,
      });

      if (assetUrl) mediaUrls = [assetUrl];
    }

    // Get valid OAuth token via proxy (handles refresh automatically)
    const token = await oauthProxy.getValidToken(post.socialAccountId);

    // Publish
    const result = await publishToplatform({
      platform: post.platform as Platform,
      organizationId: post.organizationId,
      content: post.contentText,
      hashtags: post.contentHashtags ?? [],
      mediaUrls,
      accessToken: token,
      accountId: undefined, // loaded from account in executor if needed
    });

    // Update DB
    await db
      .update(scheduledPosts)
      .set({
        status: "published",
        publishedAt: new Date(),
        platformPostId: result.postId,
        mediaUrls: mediaUrls.length > 0 ? mediaUrls : post.mediaUrls,
        updatedAt: new Date(),
      })
      .where(eq(scheduledPosts.id, postId));

    // Rule 22: Increment usage record for billing
    await incrementPost(post.organizationId);

    await logAgentAction(post.organizationId, post.agentId, postId, "post_published", {
      platformPostId: result.postId,
      platform: post.platform,
    });

    // Queue analytics fetch 30 min later
    await queueAnalyticsFetch(postId);
  },
  {
    connection: redisConnection,
    concurrency: productConfig.maxConcurrentPostJobs,
    limiter: {
      max: productConfig.maxPostJobsPerMinute,
      duration: 60_000,
    },
  },
);

worker.on("failed", async (job, err) => {
  if (job) {
    await db
      .update(scheduledPosts)
      .set({
        status: "failed",
        errorMessage: err.message,
        updatedAt: new Date(),
      })
      .where(eq(scheduledPosts.id, job.data.postId));
  }
});

worker.on("error", (err) => console.error("[PostWorker] Error:", err));

export { worker as postWorker };
