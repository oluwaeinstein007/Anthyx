import { and, eq, gte } from "drizzle-orm";
import { db } from "../db";
import { scheduledPosts, postAnalytics } from "../schema";
import { productConfig } from "@anthyx/config";

export async function readEngagementAnalytics(args: {
  brandProfileId: string;
  lookbackDays: number;
}): Promise<string> {
  const since = new Date(Date.now() - args.lookbackDays * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      voiceTrait: scheduledPosts.contentType,
      platform: scheduledPosts.platform,
      engagementRate: postAnalytics.engagementRate,
      publishedAt: scheduledPosts.publishedAt,
    })
    .from(scheduledPosts)
    .innerJoin(postAnalytics, eq(postAnalytics.postId, scheduledPosts.id))
    .where(
      and(
        eq(scheduledPosts.brandProfileId, args.brandProfileId),
        eq(scheduledPosts.status, "published"),
        gte(scheduledPosts.publishedAt, since),
      ),
    );

  if (rows.length === 0) {
    return JSON.stringify({
      hasData: false,
      message: "No published posts with analytics data yet.",
      topPerformers: [],
      lowPerformers: [],
      avgEngagementRate: 0,
      classification: { promote: [], demote: [], cut: [] },
    });
  }

  const groups = new Map<string, number[]>();
  for (const row of rows) {
    const key = `${row.voiceTrait ?? "unknown"}:${row.platform}`;
    const arr = groups.get(key) ?? [];
    arr.push(parseFloat(row.engagementRate ?? "0"));
    groups.set(key, arr);
  }

  const scores = [...groups.entries()].map(([key, rates]) => {
    const [voiceTrait, platform] = key.split(":") as [string, string];
    return { voiceTrait, platform, avgEngagementRate: rates.reduce((a, b) => a + b, 0) / rates.length, postCount: rates.length };
  });

  const sorted = [...scores].sort((a, b) => b.avgEngagementRate - a.avgEngagementRate);
  const avg = scores.reduce((a, s) => a + s.avgEngagementRate, 0) / scores.length;
  const { underperformThreshold, outperformMultiplier } = productConfig;

  return JSON.stringify({
    hasData: true,
    topPerformers: sorted.slice(0, 3).map((s) => ({ ...s, avgEngagementRate: (s.avgEngagementRate * 100).toFixed(2) + "%" })),
    lowPerformers: sorted.slice(-3).map((s) => ({ ...s, avgEngagementRate: (s.avgEngagementRate * 100).toFixed(2) + "%" })),
    avgEngagementRate: (avg * 100).toFixed(2) + "%",
    classification: {
      promote: scores.filter((s) => s.avgEngagementRate >= avg * outperformMultiplier).map((s) => `${s.voiceTrait} on ${s.platform}`),
      demote: scores.filter((s) => s.avgEngagementRate < avg && s.avgEngagementRate >= underperformThreshold).map((s) => `${s.voiceTrait} on ${s.platform}`),
      cut: scores.filter((s) => s.avgEngagementRate < underperformThreshold && s.postCount >= 5).map((s) => `${s.voiceTrait} on ${s.platform}`),
    },
  });
}
