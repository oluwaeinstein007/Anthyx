import { eq, and } from "drizzle-orm";
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
import { computeVoicePerformance, classifyVoices } from "../analytics/scorer";
import { getVetoLearningContext } from "./veto-learner";
import { embed } from "../brand-ingestion/embedder";
import { QdrantClient } from "@qdrant/js-client-rest";

const qdrant = new QdrantClient({
  url: process.env["QDRANT_URL"] ?? "http://localhost:6333",
  apiKey: process.env["QDRANT_API_KEY"],
});

const DRIFT_THRESHOLD = parseFloat(process.env["BRAND_DRIFT_THRESHOLD"] ?? "0.35");
import type { GeneratedPlanItem, Platform } from "@anthyx/types";
import { productConfig } from "@anthyx/config";

const MAX_REVIEW_RETRIES = productConfig.maxReviewRetries;

export class ReviewerRejectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewerRejectionError";
  }
}

async function detectBrandVoiceDrift(
  postContent: string,
  brandProfileId: string,
  organizationId: string,
  agentId: string,
  postId: string | null,
): Promise<void> {
  try {
    const postVector = await embed(postContent);
    const results = await qdrant.search(`brand_${brandProfileId}`, {
      vector: postVector,
      limit: 5,
      filter: {
        must: [
          { key: "brandProfileId", match: { value: brandProfileId } },
          { key: "type", match: { any: ["voice_rule", "tone_descriptor", "brand_statement"] } },
        ],
      },
      with_payload: false,
    });

    if (results.length === 0) return;

    const avgScore = results.reduce((a, r) => a + r.score, 0) / results.length;
    // Qdrant cosine similarity: 1.0 = identical, lower = more different
    // Drift = 1 - similarity; alert when drift > threshold
    const drift = 1 - avgScore;

    if (drift > DRIFT_THRESHOLD) {
      await logAgentAction(organizationId, agentId, postId, "brand_voice_drift_alert", {
        drift: drift.toFixed(4),
        threshold: DRIFT_THRESHOLD,
        avgSimilarity: avgScore.toFixed(4),
        message: `Post content has drifted ${(drift * 100).toFixed(1)}% from brand voice vectors — exceeds ${(DRIFT_THRESHOLD * 100).toFixed(0)}% threshold.`,
      });
    }
  } catch {
    // Drift detection is non-blocking — never fail the post generation flow
  }
}

async function buildEngagementInsights(
  brandProfileId: string,
  feedbackLoopEnabled: boolean,
): Promise<{ insights: string; strictReview: boolean }> {
  if (!feedbackLoopEnabled) return { insights: "", strictReview: false };

  const scores = await computeVoicePerformance(brandProfileId, 30);
  if (scores.length === 0) return { insights: "", strictReview: false };

  const { promote, cut } = classifyVoices(scores);
  const avgRate = scores.reduce((a, s) => a + s.avgEngagementRate, 0) / scores.length;

  const lines: string[] = [];
  if (promote.length) lines.push(`High-performing content types (lean into these): ${promote.join(", ")}`);
  if (cut.length) lines.push(`Underperforming content types (avoid or reframe): ${cut.join(", ")}`);
  lines.push(`Average engagement rate across all posts: ${(avgRate * 100).toFixed(2)}%`);

  // Tighten reviewer strictness when there's enough data to act on
  const strictReview = scores.length >= 5 && cut.length > 0;
  return { insights: lines.join("\n"), strictReview };
}

export async function generateAndReviewPost(
  planItem: GeneratedPlanItem & { id?: string },
  agentId: string,
  socialAccountId: string | null,
  brandProfileId: string,
  organizationId: string,
  options: { feedbackLoopEnabled?: boolean; targetLocale?: string; threadMode?: boolean } = {},
): Promise<{
  content: string;
  hashtags: string[];
  segments?: string[];
  mediaPrompt: string | null;
}> {
  const [agent, brand, account] = await Promise.all([
    db.query.agents.findFirst({ where: eq(agents.id, agentId) }),
    db.query.brandProfiles.findFirst({ where: eq(brandProfiles.id, brandProfileId) }),
    socialAccountId
      ? db.query.socialAccounts.findFirst({ where: eq(socialAccounts.id, socialAccountId) })
      : Promise.resolve(null),
  ]);

  if (!agent) throw new Error(`Agent ${agentId} not found`);
  if (!brand) throw new Error(`Brand ${brandProfileId} not found`);

  const platform = (account?.platform ?? planItem.platform) as Platform;

  const [brandVoice, { insights: engagementInsights, strictReview }, vetoCtx] = await Promise.all([
    retrieveBrandVoiceFromQdrant(brandProfileId, planItem.topic),
    buildEngagementInsights(brandProfileId, options.feedbackLoopEnabled ?? false),
    getVetoLearningContext(brandProfileId, organizationId, 30),
  ]);

  const draft = await runCopywriterAgent({
    organizationId,
    personaName: agent.name,
    brandName: brand.name,
    brandVoiceRules: brandVoice,
    dietInstructions: agent.dietInstructions ?? "",
    platform,
    topic: planItem.topic,
    contentType: planItem.contentType,
    hook: planItem.hook,
    cta: planItem.cta,
    scheduledAt: planItem.date,
    targetLocale: options.targetLocale,
    engagementInsights: engagementInsights || undefined,
    threadMode: options.threadMode,
    vetoGuidance: vetoCtx.formattedGuidance || undefined,
  });

  // Reviewer acts as adversarial compliance gate
  let currentContent = draft.content;
  let currentHashtags = draft.hashtags;
  let retries = 0;

  while (retries <= MAX_REVIEW_RETRIES) {
    const review = await runReviewerAgent({
      postContent: currentContent,
      hashtags: currentHashtags,
      platform,
      brandRules: brandVoice,
      dietInstructions: agent.dietInstructions ?? "",
      strictMode: strictReview,
    });

    if (review.verdict === "pass") {
      await logAgentAction(organizationId, agentId, planItem.id ?? null, "reviewer_pass", {
        retries,
      });
      // Non-blocking drift check — logs alert if content strays from brand voice
      void detectBrandVoiceDrift(currentContent, brandProfileId, organizationId, agentId, planItem.id ?? null);
      return {
        content: currentContent,
        hashtags: currentHashtags,
        segments: draft.segments ?? undefined,
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

const CONTENT_GEN_CONCURRENCY = 5;

// Lightweight concurrency limiter — avoids adding p-limit as a dependency
function createLimiter(concurrency: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  return async function limit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const run = () => {
        active++;
        fn().then(resolve, reject).finally(() => {
          active--;
          const next = queue.shift();
          if (next) next();
        });
      };
      if (active < concurrency) run();
      else queue.push(run);
    });
  };
}

/**
 * Run the full content generation pipeline for all draft posts in a plan.
 * Posts are processed in parallel with a concurrency cap to saturate LLM quota
 * without overwhelming it.
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

  const limit = createLimiter(CONTENT_GEN_CONCURRENCY);

  await Promise.allSettled(
    draftPosts.map((post) =>
      limit(async () => {
        try {
          const agent = await db.query.agents.findFirst({
            where: eq(agents.id, post.agentId),
          });

          if (!agent?.isActive) {
            await db
              .update(scheduledPosts)
              .set({ status: "silenced" })
              .where(eq(scheduledPosts.id, post.id));
            return;
          }

          const planItem: GeneratedPlanItem = {
            date: post.scheduledAt.toISOString(),
            platform: post.platform as Platform,
            contentType: (post.contentType as GeneratedPlanItem["contentType"]) ?? "educational",
            topic: post.contentText,
            hook: "",
            cta: "",
            suggestVisual: false,
          };

          const result = await generateAndReviewPost(
            { ...planItem, id: post.id },
            post.agentId,
            post.socialAccountId,
            post.brandProfileId,
            organizationId,
            {
              feedbackLoopEnabled: plan.feedbackLoopEnabled ?? false,
            },
          );

          await db
            .update(scheduledPosts)
            .set({
              contentText: result.content,
              contentHashtags: result.hashtags,
              suggestedMediaPrompt: result.mediaPrompt,
              segments: result.segments ?? null,
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
      }),
    ),
  );
}
