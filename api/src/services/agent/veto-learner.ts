import { eq, and, desc, gte } from "drizzle-orm";
import { db } from "../../db/client";
import { scheduledPosts, postStatusLogs } from "../../db/schema";

export interface VetoPattern {
  reason: string;
  count: number;
  exampleContent: string;
}

export interface VetoLearningContext {
  patterns: VetoPattern[];
  formattedGuidance: string;
  totalVetoed: number;
  periodDays: number;
}

export interface QualityImprovement {
  brandProfileId: string;
  periodDays: number;
  totalGenerated: number;
  totalApproved: number;
  totalVetoed: number;
  vetoRate: number;
  approvalRate: number;
  topVetoReasons: { reason: string; count: number }[];
  trend: "improving" | "stable" | "declining" | "insufficient_data";
  trendDescription: string;
  score: number; // 0–100: composite quality signal
}

/**
 * Retrieves vetoed post patterns for a brand over the last `periodDays` days.
 * Returns a guidance block for injection into the copywriter prompt.
 */
export async function getVetoLearningContext(
  brandProfileId: string,
  organizationId: string,
  periodDays = 30,
): Promise<VetoLearningContext> {
  const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

  // Get all vetoed posts for this brand in the window, with their veto reason
  const vetoLogs = await db.query.postStatusLogs.findMany({
    where: and(
      eq(postStatusLogs.organizationId, organizationId),
    ),
    orderBy: [desc(postStatusLogs.createdAt)],
    limit: 200,
  });

  // Filter to veto events within window
  const vetoEvents = vetoLogs.filter(
    (l) =>
      l.toStatus === "vetoed" &&
      l.createdAt &&
      l.createdAt >= since,
  );

  if (vetoEvents.length === 0) {
    return {
      patterns: [],
      formattedGuidance: "",
      totalVetoed: 0,
      periodDays,
    };
  }

  // Fetch the associated post content for brand-scoped veto examples
  const postIds = [...new Set(vetoEvents.map((v) => v.postId))];
  const vetoedPosts = postIds.length > 0
    ? await db.query.scheduledPosts.findMany({
        where: and(
          eq(scheduledPosts.brandProfileId, brandProfileId),
          eq(scheduledPosts.organizationId, organizationId),
        ),
        columns: { id: true, contentText: true, platform: true },
      })
    : [];

  const postMap = new Map(vetoedPosts.map((p) => [p.id, p]));

  // Group by reason
  const reasonGroups = new Map<string, { count: number; examples: string[] }>();
  for (const event of vetoEvents) {
    const post = postMap.get(event.postId);
    if (!post) continue; // post belongs to a different brand — skip

    const reason = event.reason?.trim() || "Unspecified";
    const group = reasonGroups.get(reason) ?? { count: 0, examples: [] };
    group.count++;
    if (group.examples.length < 2 && post.contentText) {
      group.examples.push(`[${post.platform}] ${post.contentText.slice(0, 120)}`);
    }
    reasonGroups.set(reason, group);
  }

  const patterns: VetoPattern[] = [...reasonGroups.entries()]
    .map(([reason, g]) => ({
      reason,
      count: g.count,
      exampleContent: g.examples.join(" | "),
    }))
    .sort((a, b) => b.count - a.count);

  const formattedGuidance = buildVetoGuidance(patterns);

  return {
    patterns,
    formattedGuidance,
    totalVetoed: vetoEvents.length,
    periodDays,
  };
}

function buildVetoGuidance(patterns: VetoPattern[]): string {
  if (patterns.length === 0) return "";

  const lines = [
    "## Negative Examples — Content to Avoid",
    "The following patterns have been flagged and rejected by human reviewers for this brand.",
    "Do NOT repeat these patterns. Learn from them and produce content that avoids these failure modes.",
    "",
  ];

  for (const p of patterns.slice(0, 5)) {
    lines.push(`### Reject reason: "${p.reason}" (flagged ${p.count}×)`);
    if (p.exampleContent) {
      lines.push(`Example vetoed content: "${p.exampleContent}"`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Computes a quality improvement score for a brand's AI generation.
 * Returns approval rate, veto trend, top reasons, and a composite quality score.
 */
export async function computeQualityImprovement(
  brandProfileId: string,
  organizationId: string,
  periodDays = 60,
): Promise<QualityImprovement> {
  const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
  const midpoint = new Date(Date.now() - (periodDays / 2) * 24 * 60 * 60 * 1000);

  // All posts for this brand in window
  const allPosts = await db.query.scheduledPosts.findMany({
    where: and(
      eq(scheduledPosts.brandProfileId, brandProfileId),
      eq(scheduledPosts.organizationId, organizationId),
      gte(scheduledPosts.createdAt, since),
    ),
    columns: { id: true, status: true, createdAt: true },
  });

  const totalGenerated = allPosts.length;
  const totalApproved = allPosts.filter((p) =>
    ["approved", "scheduled", "published"].includes(p.status ?? ""),
  ).length;
  const totalVetoed = allPosts.filter((p) => p.status === "vetoed").length;

  const reviewable = totalApproved + totalVetoed;
  const approvalRate = reviewable > 0 ? totalApproved / reviewable : 0;
  const vetoRate = reviewable > 0 ? totalVetoed / reviewable : 0;

  // Trend: compare first half vs second half of window
  const firstHalf = allPosts.filter(
    (p) => p.createdAt && p.createdAt < midpoint,
  );
  const secondHalf = allPosts.filter(
    (p) => p.createdAt && p.createdAt >= midpoint,
  );

  const vetoRateFirst = computeVetoRate(firstHalf);
  const vetoRateSecond = computeVetoRate(secondHalf);

  let trend: QualityImprovement["trend"] = "insufficient_data";
  let trendDescription = "Not enough data yet to determine trend.";

  if (firstHalf.length >= 3 && secondHalf.length >= 3) {
    const delta = vetoRateFirst - vetoRateSecond;
    if (delta > 0.05) {
      trend = "improving";
      trendDescription = `Veto rate dropped from ${(vetoRateFirst * 100).toFixed(0)}% to ${(vetoRateSecond * 100).toFixed(0)}% — the AI is learning your preferences.`;
    } else if (delta < -0.05) {
      trend = "declining";
      trendDescription = `Veto rate increased from ${(vetoRateFirst * 100).toFixed(0)}% to ${(vetoRateSecond * 100).toFixed(0)}% — review your brand context.`;
    } else {
      trend = "stable";
      trendDescription = `Veto rate is stable around ${(vetoRate * 100).toFixed(0)}%.`;
    }
  }

  // Top veto reasons from status logs
  const allLogs = await db.query.postStatusLogs.findMany({
    where: and(
      eq(postStatusLogs.organizationId, organizationId),
      gte(postStatusLogs.createdAt, since),
    ),
    columns: { toStatus: true, reason: true, postId: true },
  });

  const brandPostIds = new Set(allPosts.map((p) => p.id));
  const vetoLogsForBrand = allLogs.filter(
    (l) => l.toStatus === "vetoed" && brandPostIds.has(l.postId),
  );

  const reasonCounts = new Map<string, number>();
  for (const log of vetoLogsForBrand) {
    const r = log.reason?.trim() || "Unspecified";
    reasonCounts.set(r, (reasonCounts.get(r) ?? 0) + 1);
  }

  const topVetoReasons = [...reasonCounts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Composite quality score (0–100)
  // Based on: approval rate, trend, data volume
  const baseScore = Math.round(approvalRate * 100);
  const trendBonus = trend === "improving" ? 5 : trend === "declining" ? -10 : 0;
  const score = Math.min(100, Math.max(0, baseScore + trendBonus));

  return {
    brandProfileId,
    periodDays,
    totalGenerated,
    totalApproved,
    totalVetoed,
    vetoRate,
    approvalRate,
    topVetoReasons,
    trend,
    trendDescription,
    score,
  };
}

function computeVetoRate(posts: { status: string | null }[]): number {
  const reviewed = posts.filter((p) =>
    ["approved", "scheduled", "published", "vetoed"].includes(p.status ?? ""),
  );
  if (reviewed.length === 0) return 0;
  return reviewed.filter((p) => p.status === "vetoed").length / reviewed.length;
}
