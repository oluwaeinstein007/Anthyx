import { Router } from "express";
import { eq, and, gte, desc } from "drizzle-orm";
import { db } from "../db/client";
import { scheduledPosts, postAnalytics } from "../db/schema";
import { auth } from "../middleware/auth";
import { computeVoicePerformance } from "../services/analytics/scorer";

const router = Router();

// GET /analytics — org-level engagement overview
router.get("/", auth, async (req, res) => {
  const lookback = parseInt(String(req.query["days"] ?? "30"));
  const since = new Date(Date.now() - lookback * 24 * 60 * 60 * 1000);

  const recentPosts = await db.query.scheduledPosts.findMany({
    where: and(
      eq(scheduledPosts.organizationId, req.user.orgId),
      eq(scheduledPosts.status, "published"),
      gte(scheduledPosts.publishedAt, since),
    ),
    orderBy: (p, { desc }) => [desc(p.publishedAt)],
    limit: 100,
  });

  const postIds = recentPosts.map((p) => p.id);

  const analyticsData =
    postIds.length > 0
      ? await db.query.postAnalytics.findMany({
          where: (a) => {
            const { inArray } = require("drizzle-orm");
            return inArray(a.postId, postIds);
          },
        })
      : [];

  // Aggregate by platform
  const byPlatform: Record<string, { posts: number; totalEngagement: number; avgRate: number }> = {};
  for (const post of recentPosts) {
    const analytics = analyticsData.find((a) => a.postId === post.id);
    if (!byPlatform[post.platform]) {
      byPlatform[post.platform] = { posts: 0, totalEngagement: 0, avgRate: 0 };
    }
    byPlatform[post.platform]!.posts++;
    if (analytics) {
      byPlatform[post.platform]!.totalEngagement += parseFloat(analytics.engagementRate ?? "0");
    }
  }

  for (const platform of Object.keys(byPlatform)) {
    const entry = byPlatform[platform]!;
    entry.avgRate = entry.posts > 0 ? entry.totalEngagement / entry.posts : 0;
  }

  return res.json({
    totalPublished: recentPosts.length,
    byPlatform,
    recentPosts: recentPosts.slice(0, 10),
  });
});

// GET /analytics/brand/:brandProfileId — brand-specific performance
router.get("/brand/:brandProfileId", auth, async (req, res) => {
  const lookbackDays = parseInt(String(req.query["days"] ?? "30"));
  const scores = await computeVoicePerformance(req.params.brandProfileId!, lookbackDays);
  return res.json(scores);
});

export { router as analyticsRouter };
