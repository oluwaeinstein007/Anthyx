import { Router } from "express";
import { eq, and, gte, desc, inArray } from "drizzle-orm";
import { db } from "../db/client";
import { scheduledPosts, postAnalytics, brandProfiles } from "../db/schema";
import { auth } from "../middleware/auth";
import { computeVoicePerformance } from "../services/analytics/scorer";

const router = Router();

// GET /analytics — org-level engagement overview
// Query params: days, brandProfileId
router.get("/", auth, async (req, res) => {
  const lookback = parseInt(String(req.query["days"] ?? "30"));
  const brandProfileId = req.query["brandProfileId"] as string | undefined;
  const since = new Date(Date.now() - lookback * 24 * 60 * 60 * 1000);

  const filters = [
    eq(scheduledPosts.organizationId, req.user.orgId),
    eq(scheduledPosts.status, "published"),
    gte(scheduledPosts.publishedAt, since),
  ] as const;

  const brandFilter = brandProfileId
    ? and(...filters, eq(scheduledPosts.brandProfileId, brandProfileId))
    : and(...filters);

  const recentPosts = await db.query.scheduledPosts.findMany({
    where: brandFilter,
    orderBy: (p, { desc }) => [desc(p.publishedAt)],
    limit: 100,
  });

  const postIds = recentPosts.map((p) => p.id);

  const analyticsData =
    postIds.length > 0
      ? await db.query.postAnalytics.findMany({
          where: inArray(postAnalytics.postId, postIds),
        })
      : [];

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

// GET /analytics/posts — paginated published posts sorted by engagement rate
// Query params: brandProfileId, platform, limit, offset
router.get("/posts", auth, async (req, res) => {
  const { brandProfileId, platform, limit: limitStr, offset: offsetStr } = req.query as Record<string, string | undefined>;
  const limit = Math.min(parseInt(limitStr ?? "50"), 200);
  const offset = parseInt(offsetStr ?? "0");

  const conditions = [
    eq(scheduledPosts.organizationId, req.user.orgId),
    eq(scheduledPosts.status, "published"),
  ];
  if (brandProfileId) conditions.push(eq(scheduledPosts.brandProfileId, brandProfileId) as never);
  if (platform) conditions.push(eq(scheduledPosts.platform, platform as never) as never);

  const posts = await db.query.scheduledPosts.findMany({
    where: and(...(conditions as [ReturnType<typeof eq>, ...ReturnType<typeof eq>[]])),
    orderBy: [desc(scheduledPosts.publishedAt)],
    limit,
    offset,
  });

  const postIds = posts.map((p) => p.id);
  const analyticsData =
    postIds.length > 0
      ? await db.query.postAnalytics.findMany({
          where: inArray(postAnalytics.postId, postIds),
        })
      : [];

  const postsWithAnalytics = posts.map((post) => {
    const analytics = analyticsData.find((a) => a.postId === post.id);
    return { ...post, analytics: analytics ?? null };
  });

  postsWithAnalytics.sort((a, b) => {
    const rateA = parseFloat(a.analytics?.engagementRate ?? "0");
    const rateB = parseFloat(b.analytics?.engagementRate ?? "0");
    return rateB - rateA;
  });

  return res.json({ posts: postsWithAnalytics, total: postsWithAnalytics.length, limit, offset });
});

// GET /analytics/posts/:postId — single post detail with all metrics
router.get("/posts/:postId", auth, async (req, res) => {
  const post = await db.query.scheduledPosts.findFirst({
    where: and(
      eq(scheduledPosts.id, req.params.postId!),
      eq(scheduledPosts.organizationId, req.user.orgId),
    ),
  });
  if (!post) return res.status(404).json({ error: "Not found" });

  const analytics = await db.query.postAnalytics.findMany({
    where: eq(postAnalytics.postId, post.id),
    orderBy: [desc(postAnalytics.fetchedAt)],
  });

  return res.json({ post, analytics });
});

// GET /analytics/brand/:brandProfileId — brand-specific content-type performance
router.get("/brand/:brandProfileId", auth, async (req, res) => {
  const brand = await db.query.brandProfiles.findFirst({
    where: and(
      eq(brandProfiles.id, req.params.brandProfileId!),
      eq(brandProfiles.organizationId, req.user.orgId),
    ),
  });
  if (!brand) return res.status(404).json({ error: "Brand not found" });

  const lookbackDays = parseInt(String(req.query["days"] ?? "30"));
  const scores = await computeVoicePerformance(req.params.brandProfileId!, lookbackDays);
  return res.json(scores);
});

export { router as analyticsRouter };
