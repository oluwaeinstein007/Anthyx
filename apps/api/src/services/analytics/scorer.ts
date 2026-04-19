import { and, eq, gte } from "drizzle-orm";
import { db } from "../../db/client";
import { scheduledPosts, postAnalytics } from "../../db/schema";
import type { Platform } from "@anthyx/types";
import { productConfig } from "@anthyx/config";

export interface ContentTypePerformanceScore {
  contentType: string;
  platform: Platform;
  avgEngagementRate: number;
  postCount: number;
  trend: "rising" | "flat" | "declining";
}

/** @deprecated Use ContentTypePerformanceScore — voiceTrait was misnamed (it grouped by contentType) */
export type VoicePerformanceScore = ContentTypePerformanceScore;

export async function computeVoicePerformance(
  brandProfileId: string,
  lookbackDays = 30,
): Promise<ContentTypePerformanceScore[]> {
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      contentType: scheduledPosts.contentType,
      platform: scheduledPosts.platform,
      engagementRate: postAnalytics.engagementRate,
      publishedAt: scheduledPosts.publishedAt,
    })
    .from(scheduledPosts)
    .innerJoin(postAnalytics, eq(postAnalytics.postId, scheduledPosts.id))
    .where(
      and(
        eq(scheduledPosts.brandProfileId, brandProfileId),
        eq(scheduledPosts.status, "published"),
        gte(scheduledPosts.publishedAt, since),
      ),
    );

  // Group by contentType:platform
  const groups = new Map<string, { rates: number[]; dates: Date[] }>();

  for (const row of rows) {
    const key = `${row.contentType ?? "unknown"}:${row.platform}`;
    if (!groups.has(key)) groups.set(key, { rates: [], dates: [] });
    const group = groups.get(key)!;
    group.rates.push(parseFloat(row.engagementRate ?? "0"));
    if (row.publishedAt) group.dates.push(row.publishedAt);
  }

  const scores: ContentTypePerformanceScore[] = [];
  for (const [key, { rates }] of groups.entries()) {
    const [contentType, platform] = key.split(":") as [string, Platform];
    const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
    scores.push({
      contentType,
      platform,
      avgEngagementRate: avg,
      postCount: rates.length,
      trend: computeTrend(rates),
    });
  }

  return scores;
}

function computeTrend(rates: number[]): "rising" | "flat" | "declining" {
  if (rates.length < 3) return "flat";
  const n = rates.length;
  const x = Array.from({ length: n }, (_, i) => i);
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = rates.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((acc, xi, i) => acc + xi * (rates[i] ?? 0), 0);
  const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

  if (slope > 0.001) return "rising";
  if (slope < -0.001) return "declining";
  return "flat";
}

export function classifyVoices(scores: ContentTypePerformanceScore[]): {
  promote: string[];
  demote: string[];
  cut: string[];
} {
  if (scores.length === 0) return { promote: [], demote: [], cut: [] };

  const avgOverall = scores.reduce((a, s) => a + s.avgEngagementRate, 0) / scores.length;
  const { underperformThreshold, outperformMultiplier } = productConfig;

  return {
    promote: scores
      .filter((s) => s.avgEngagementRate >= avgOverall * outperformMultiplier)
      .map((s) => `${s.contentType} on ${s.platform}`),
    demote: scores
      .filter(
        (s) =>
          s.avgEngagementRate < avgOverall &&
          s.avgEngagementRate >= underperformThreshold,
      )
      .map((s) => `${s.contentType} on ${s.platform}`),
    cut: scores
      .filter(
        (s) => s.avgEngagementRate < underperformThreshold && s.postCount >= 5,
      )
      .map((s) => `${s.contentType} on ${s.platform}`),
  };
}
