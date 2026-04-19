import { eq, and, inArray } from "drizzle-orm";
import { db } from "../../db/client";
import {
  agents,
  brandProfiles,
  socialAccounts,
  scheduledPosts,
  marketingPlans,
} from "../../db/schema";
import { runCopywriterAgent } from "./copywriter";
import { runReviewerAgent } from "./reviewer";
import { retrieveBrandVoiceFromQdrant } from "./brand-context";
import { logAgentAction } from "./logger";
import type { GeneratedPlanItem, Platform } from "@anthyx/types";
import { productConfig } from "@anthyx/config";

const MAX_REVIEW_RETRIES = productConfig.maxReviewRetries;

export class ReviewerRejectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewerRejectionError";
  }
}

export async function generateAndReviewPost(
  planItem: GeneratedPlanItem & { id?: string },
  agentId: string,
  socialAccountId: string,
  brandProfileId: string,
  organizationId: string,
): Promise<{
  content: string;
  hashtags: string[];
  mediaPrompt: string | null;
}> {
  const [agent, brand, account] = await Promise.all([
    db.query.agents.findFirst({ where: eq(agents.id, agentId) }),
    db.query.brandProfiles.findFirst({ where: eq(brandProfiles.id, brandProfileId) }),
    db.query.socialAccounts.findFirst({ where: eq(socialAccounts.id, socialAccountId) }),
  ]);

  if (!agent) throw new Error(`Agent ${agentId} not found`);
  if (!brand) throw new Error(`Brand ${brandProfileId} not found`);
  if (!account) throw new Error(`Social account ${socialAccountId} not found`);

  // Step 1: Copywriter generates the post
  const brandVoice = await retrieveBrandVoiceFromQdrant(brandProfileId, planItem.topic);

  const draft = await runCopywriterAgent({
    organizationId,
    personaName: agent.name,
    brandName: brand.name,
    brandVoiceRules: brandVoice,
    dietInstructions: agent.dietInstructions ?? "",
    platform: account.platform as Platform,
    topic: planItem.topic,
    contentType: planItem.contentType,
    hook: planItem.hook,
    cta: planItem.cta,
    scheduledAt: planItem.date,
  });

  // Step 2: Reviewer acts as adversarial compliance gate
  // NOTE: The Reviewer does NOT receive the Copywriter's reasoning — only the output
  let currentContent = draft.content;
  let currentHashtags = draft.hashtags;
  let retries = 0;

  while (retries <= MAX_REVIEW_RETRIES) {
    const review = await runReviewerAgent({
      postContent: currentContent,
      hashtags: currentHashtags,
      platform: account.platform as Platform,
      brandRules: brandVoice,
      dietInstructions: agent.dietInstructions ?? "",
    });

    if (review.verdict === "pass") {
      await logAgentAction(organizationId, agentId, planItem.id ?? null, "reviewer_pass", {
        retries,
      });
      return {
        content: currentContent,
        hashtags: currentHashtags,
        mediaPrompt: draft.suggestedMediaPrompt,
      };
    }

    if (review.verdict === "rewrite" && review.revisedContent) {
      await logAgentAction(organizationId, agentId, planItem.id ?? null, "reviewer_rewrite", {
        issues: review.issues,
        retry: retries,
      });
      currentContent = review.revisedContent;
      currentHashtags = review.revisedHashtags ?? currentHashtags;
      retries++;
      continue;
    }

    // verdict === 'fail' or rewrite without revisedContent
    await logAgentAction(organizationId, agentId, planItem.id ?? null, "reviewer_fail", {
      issues: review.issues,
    });
    throw new ReviewerRejectionError(`Post failed compliance: ${review.issues.join("; ")}`);
  }

  throw new ReviewerRejectionError("Exceeded max review retries");
}

/**
 * Run the full content generation pipeline for all draft posts in a plan.
 */
export async function generateContentForPlan(planId: string, organizationId: string): Promise<void> {
  const plan = await db.query.marketingPlans.findFirst({
    where: and(
      eq(marketingPlans.id, planId),
      eq(marketingPlans.organizationId, organizationId),
    ),
  });

  if (!plan) throw new Error(`Plan ${planId} not found`);

  const draftPosts = await db.query.scheduledPosts.findMany({
    where: and(
      eq(scheduledPosts.planId, planId),
      eq(scheduledPosts.status, "draft"),
    ),
  });

  for (const post of draftPosts) {
    try {
      // Check agent is still active
      const agent = await db.query.agents.findFirst({
        where: eq(agents.id, post.agentId),
      });

      if (!agent?.isActive) {
        await db
          .update(scheduledPosts)
          .set({ status: "silenced" })
          .where(eq(scheduledPosts.id, post.id));
        continue;
      }

      const planItem: GeneratedPlanItem = {
        date: post.scheduledAt.toISOString(),
        platform: post.platform as Platform,
        contentType: (post.contentType as GeneratedPlanItem["contentType"]) ?? "educational",
        topic: post.contentText, // In draft, contentText holds the topic/hook from the plan
        hook: "",
        cta: "",
        suggestVisual: false,
      };

      if (!post.socialAccountId) {
        await db
          .update(scheduledPosts)
          .set({ status: "failed", errorMessage: "No social account linked to this post", updatedAt: new Date() })
          .where(eq(scheduledPosts.id, post.id));
        continue;
      }

      const result = await generateAndReviewPost(
        { ...planItem, id: post.id },
        post.agentId,
        post.socialAccountId,
        post.brandProfileId,
        organizationId,
      );

      await db
        .update(scheduledPosts)
        .set({
          contentText: result.content,
          contentHashtags: result.hashtags,
          suggestedMediaPrompt: result.mediaPrompt,
          status: "pending_review",
          updatedAt: new Date(),
        })
        .where(eq(scheduledPosts.id, post.id));
    } catch (err) {
      await db
        .update(scheduledPosts)
        .set({
          status: "failed",
          errorMessage: err instanceof Error ? err.message : String(err),
          updatedAt: new Date(),
        })
        .where(eq(scheduledPosts.id, post.id));
    }
  }
}
