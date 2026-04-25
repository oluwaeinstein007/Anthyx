import { eq, and } from "drizzle-orm";
import { db } from "../../db/client";
import { scheduledPosts, postAnalytics, abTests, agents, brandProfiles, socialAccounts } from "../../db/schema";
import { runCopywriterAgent } from "./copywriter";
import { runReviewerAgent } from "./reviewer";
import { retrieveBrandVoiceFromQdrant } from "./brand-context";
import type { Platform } from "@anthyx/types";

/**
 * Generate two content variants for a given post, run both through the reviewer,
 * and store them as a linked A/B test pair.
 *
 * Variant A: the standard copywriter output
 * Variant B: copywriter with explicit instruction to try a different angle/hook
 */
export async function generateAbVariants(
  postId: string,
  organizationId: string,
): Promise<{ abTestId: string; variantAId: string; variantBId: string }> {
  const post = await db.query.scheduledPosts.findFirst({
    where: and(eq(scheduledPosts.id, postId), eq(scheduledPosts.organizationId, organizationId)),
  });
  if (!post) throw new Error(`Post ${postId} not found`);
  if (post.status !== "pending_review") throw new Error("A/B test can only be created for pending_review posts");

  const [agent, brand, account] = await Promise.all([
    db.query.agents.findFirst({ where: eq(agents.id, post.agentId) }),
    db.query.brandProfiles.findFirst({ where: eq(brandProfiles.id, post.brandProfileId) }),
    post.socialAccountId
      ? db.query.socialAccounts.findFirst({ where: eq(socialAccounts.id, post.socialAccountId) })
      : Promise.resolve(null),
  ]);

  if (!agent || !brand) throw new Error("Agent or brand not found");

  const platform = (account?.platform ?? post.platform) as Platform;
  const brandVoice = await retrieveBrandVoiceFromQdrant(post.brandProfileId, post.contentText);

  const baseInput = {
    organizationId,
    personaName: agent.name,
    brandName: brand.name,
    brandVoiceRules: brandVoice,
    dietInstructions: agent.dietInstructions ?? "",
    platform,
    topic: post.contentText,
    contentType: post.contentType ?? "educational",
    hook: "",
    cta: "",
    scheduledAt: post.scheduledAt.toISOString(),
  };

  // Variant B: explicitly different angle
  const variantBInput = {
    ...baseInput,
    dietInstructions: (baseInput.dietInstructions ? baseInput.dietInstructions + "\n\n" : "") +
      "IMPORTANT: Generate a DIFFERENT approach from what you would normally write. Try a contrasting hook style, different emotional angle, or alternative framing. The goal is to produce a meaningfully different variant for A/B testing.",
  };

  const [draftA, draftB] = await Promise.all([
    runCopywriterAgent(baseInput),
    runCopywriterAgent(variantBInput),
  ]);

  // Review both variants
  const reviewInput = {
    hashtags: draftA.hashtags,
    platform,
    brandRules: brandVoice,
    dietInstructions: agent.dietInstructions ?? "",
  };

  const [reviewA, reviewB] = await Promise.all([
    runReviewerAgent({ ...reviewInput, postContent: draftA.content }),
    runReviewerAgent({ ...reviewInput, postContent: draftB.content, hashtags: draftB.hashtags }),
  ]);

  const contentA = reviewA.verdict === "rewrite" ? (reviewA.revisedContent ?? draftA.content) : draftA.content;
  const contentB = reviewB.verdict === "rewrite" ? (reviewB.revisedContent ?? draftB.content) : draftB.content;

  // Post A is the original post (already exists) — update its content with variant A
  await db
    .update(scheduledPosts)
    .set({ contentText: contentA, contentHashtags: draftA.hashtags, updatedAt: new Date() })
    .where(eq(scheduledPosts.id, post.id));

  // Variant B is a new sibling post scheduled at the same time but for a different audience slice
  const [variantBPost] = await db
    .insert(scheduledPosts)
    .values({
      planId: post.planId,
      socialAccountId: post.socialAccountId,
      agentId: post.agentId,
      organizationId,
      brandProfileId: post.brandProfileId,
      platform: post.platform,
      contentText: contentB,
      contentType: post.contentType,
      contentHashtags: draftB.hashtags,
      scheduledAt: post.scheduledAt,
      status: "pending_review",
      suggestedMediaPrompt: draftB.suggestedMediaPrompt,
    })
    .returning();

  if (!variantBPost) throw new Error("Failed to create variant B post");

  // Create the A/B test record
  const [abTest] = await db
    .insert(abTests)
    .values({
      organizationId,
      postAId: post.id,
      postBId: variantBPost.id,
      status: "running",
    })
    .returning();

  if (!abTest) throw new Error("Failed to create A/B test record");

  return { abTestId: abTest.id, variantAId: post.id, variantBId: variantBPost.id };
}

/**
 * Evaluate a running A/B test and promote the winner.
 * Winner = variant with higher avgEngagementRate.
 */
export async function evaluateAndPromoteWinner(abTestId: string): Promise<{ winnerId: string; reason: string }> {
  const abTest = await db.query.abTests.findFirst({ where: eq(abTests.id, abTestId) });
  if (!abTest) throw new Error(`A/B test ${abTestId} not found`);
  if (abTest.status !== "running") throw new Error("A/B test is not running");

  const [analyticsA, analyticsB] = await Promise.all([
    db.query.postAnalytics.findMany({ where: eq(postAnalytics.postId, abTest.postAId) }),
    db.query.postAnalytics.findMany({ where: eq(postAnalytics.postId, abTest.postBId) }),
  ]);

  const avgRate = (rows: typeof analyticsA) =>
    rows.length === 0
      ? 0
      : rows.reduce((a, r) => a + parseFloat(r.engagementRate ?? "0"), 0) / rows.length;

  const rateA = avgRate(analyticsA);
  const rateB = avgRate(analyticsB);

  if (rateA === 0 && rateB === 0) {
    throw new Error("No engagement data yet — wait for both posts to accumulate metrics");
  }

  const winnerId = rateA >= rateB ? abTest.postAId : abTest.postBId;
  const reason = `Variant ${rateA >= rateB ? "A" : "B"} won with ${Math.max(rateA, rateB).toFixed(4)} avg engagement rate vs ${Math.min(rateA, rateB).toFixed(4)}`;

  await db
    .update(abTests)
    .set({ winnerId, status: "winner_promoted", promotedAt: new Date(), updatedAt: new Date() })
    .where(eq(abTests.id, abTestId));

  return { winnerId, reason };
}
