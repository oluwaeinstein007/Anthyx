import { Router } from "express";
import { eq, and, gte, desc, inArray, sql } from "drizzle-orm";
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

// GET /analytics/export — CSV download of published posts with engagement data
router.get("/export", auth, async (req, res) => {
  const { brandProfileId, platform, days } = req.query as Record<string, string | undefined>;
  const lookback = parseInt(days ?? "90");
  const since = new Date(Date.now() - lookback * 24 * 60 * 60 * 1000);

  const conditions = [
    eq(scheduledPosts.organizationId, req.user.orgId),
    eq(scheduledPosts.status, "published"),
    gte(scheduledPosts.publishedAt, since),
  ];
  if (brandProfileId) conditions.push(eq(scheduledPosts.brandProfileId, brandProfileId) as never);
  if (platform) conditions.push(eq(scheduledPosts.platform, platform as never) as never);

  const posts = await db.query.scheduledPosts.findMany({
    where: and(...(conditions as [ReturnType<typeof eq>, ...ReturnType<typeof eq>[]])),
    orderBy: [desc(scheduledPosts.publishedAt)],
    limit: 10000,
  });

  const postIds = posts.map((p) => p.id);
  const analyticsData =
    postIds.length > 0
      ? await db.query.postAnalytics.findMany({
          where: inArray(postAnalytics.postId, postIds),
        })
      : [];

  const analyticsMap = new Map(analyticsData.map((a) => [a.postId, a]));

  const header =
    "id,platform,status,scheduledAt,publishedAt,likes,reposts,comments,impressions,clicks,engagementRate,contentText\n";

  const escape = (s: string) => `"${s.replace(/"/g, '""').replace(/\n/g, " ")}"`;

  const rows = posts
    .map((p) => {
      const a = analyticsMap.get(p.id);
      return [
        p.id,
        p.platform,
        p.status,
        p.scheduledAt?.toISOString() ?? "",
        p.publishedAt?.toISOString() ?? "",
        a?.likes ?? 0,
        a?.reposts ?? 0,
        a?.comments ?? 0,
        a?.impressions ?? 0,
        a?.clicks ?? 0,
        a?.engagementRate ?? "",
        escape(p.contentText ?? ""),
      ].join(",");
    })
    .join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="analytics-export-${new Date().toISOString().slice(0, 10)}.csv"`,
  );
  return res.send(header + rows);
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

// GET /analytics/weekly — engagement totals grouped by ISO week (last N weeks)
// Query params: weeks (default 12), brandProfileId
router.get("/weekly", auth, async (req, res) => {
  const weeks = Math.min(parseInt(String(req.query["weeks"] ?? "12")), 52);
  const brandProfileId = req.query["brandProfileId"] as string | undefined;
  const since = new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000);

  const conditions = [
    eq(scheduledPosts.organizationId, req.user.orgId),
    eq(scheduledPosts.status, "published"),
    gte(scheduledPosts.publishedAt, since),
  ];
  if (brandProfileId) conditions.push(eq(scheduledPosts.brandProfileId, brandProfileId) as never);

  const posts = await db.query.scheduledPosts.findMany({
    where: and(...(conditions as [ReturnType<typeof eq>, ...ReturnType<typeof eq>[]])),
    orderBy: [desc(scheduledPosts.publishedAt)],
    limit: 5000,
  });

  const postIds = posts.map((p) => p.id);
  const analyticsData =
    postIds.length > 0
      ? await db.query.postAnalytics.findMany({
          where: inArray(postAnalytics.postId, postIds),
        })
      : [];

  const analyticsMap = new Map(analyticsData.map((a) => [a.postId, a]));

  // Group by ISO week (YYYY-Www)
  const weekMap: Record<string, { week: string; likes: number; reposts: number; comments: number; impressions: number; posts: number }> = {};

  for (const post of posts) {
    const d = post.publishedAt ? new Date(post.publishedAt) : new Date(post.scheduledAt);
    // ISO week label: YYYY-Www
    const jan4 = new Date(d.getFullYear(), 0, 4);
    const startOfWeek1 = new Date(jan4.getTime() - (jan4.getDay() || 7 - 1) * 86400000);
    const weekNum = Math.ceil((((d.getTime() - startOfWeek1.getTime()) / 86400000) + 1) / 7);
    const weekLabel = `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;

    if (!weekMap[weekLabel]) {
      weekMap[weekLabel] = { week: weekLabel, likes: 0, reposts: 0, comments: 0, impressions: 0, posts: 0 };
    }
    weekMap[weekLabel]!.posts++;

    const a = analyticsMap.get(post.id);
    if (a) {
      weekMap[weekLabel]!.likes += a.likes ?? 0;
      weekMap[weekLabel]!.reposts += a.reposts ?? 0;
      weekMap[weekLabel]!.comments += a.comments ?? 0;
      weekMap[weekLabel]!.impressions += a.impressions ?? 0;
    }
  }

  const series = Object.values(weekMap).sort((a, b) => a.week.localeCompare(b.week));
  return res.json(series);
});

// POST /analytics/interpret — AI summary of recent performance using Gemini → Claude
router.post("/interpret", auth, async (req, res) => {
  try {
    const lookback = parseInt(String(req.query["days"] ?? "30"));
    const since = new Date(Date.now() - lookback * 24 * 60 * 60 * 1000);

    const posts = await db.query.scheduledPosts.findMany({
      where: and(
        eq(scheduledPosts.organizationId, req.user.orgId),
        eq(scheduledPosts.status, "published"),
        gte(scheduledPosts.publishedAt, since),
      ),
      orderBy: [desc(scheduledPosts.publishedAt)],
      limit: 100,
    });

    if (posts.length === 0) {
      return res.json({
        summary: "No published posts in this period yet. Start publishing to unlock AI performance insights.",
        recommendation: null,
      });
    }

    const postIds = posts.map((p) => p.id);
    const analyticsData = await db.query.postAnalytics.findMany({
      where: inArray(postAnalytics.postId, postIds),
    });

    const analyticsMap = new Map(analyticsData.map((a) => [a.postId, a]));

    // Aggregate by platform
    const byPlatform: Record<string, { posts: number; totalLikes: number; totalComments: number; totalImpressions: number; totalEngRate: number }> = {};
    for (const post of posts) {
      if (!byPlatform[post.platform]) byPlatform[post.platform] = { posts: 0, totalLikes: 0, totalComments: 0, totalImpressions: 0, totalEngRate: 0 };
      byPlatform[post.platform]!.posts++;
      const a = analyticsMap.get(post.id);
      if (a) {
        byPlatform[post.platform]!.totalLikes += a.likes ?? 0;
        byPlatform[post.platform]!.totalComments += a.comments ?? 0;
        byPlatform[post.platform]!.totalImpressions += a.impressions ?? 0;
        byPlatform[post.platform]!.totalEngRate += parseFloat(a.engagementRate ?? "0");
      }
    }

    const snapshot = Object.entries(byPlatform)
      .map(([platform, s]) => `${platform}: ${s.posts} posts, ${s.totalLikes} likes, ${s.totalComments} comments, ${s.totalImpressions} impressions, avg engagement ${s.posts > 0 ? ((s.totalEngRate / s.posts) * 100).toFixed(1) : 0}%`)
      .join("\n");

    const { generateWithFallback } = await import("../services/agent/llm-client");

    const text = await generateWithFallback({
      systemPrompt: `You are a social media analytics expert. Given a 30-day performance snapshot, write exactly 3 sentences: (1) what performed best and why, (2) one area for improvement, (3) one specific recommended action. Be concise and data-driven. No bullet points.`,
      userMessage: `Period: last ${lookback} days\nTotal posts: ${posts.length}\n\n${snapshot}`,
      maxTokens: 250,
    });

    return res.json({ summary: text });
  } catch (err) {
    console.error("[analytics/interpret]", err);
    return res.status(500).json({ error: "AI interpretation failed" });
  }
});

export { router as analyticsRouter };
