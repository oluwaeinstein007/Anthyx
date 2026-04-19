import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../db/client";
import {
  marketingPlans,
  scheduledPosts,
  postAnalytics,
  brandProfiles,
  subscriptions,
  planTiers,
} from "../db/schema";
import { auth } from "../middleware/auth";

const router = Router();

// GET /reports/plan/:planId — CSV export of plan performance
// Gated behind whiteLabel tier flag (agency+).
router.get("/plan/:planId", auth, async (req, res) => {
  // Check white-label entitlement
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.organizationId, req.user.orgId),
  });
  const tier = sub ? await db.query.planTiers.findFirst({ where: eq(planTiers.tier, sub.tier) }) : null;

  if (!tier?.whiteLabel) {
    return res.status(403).json({
      error: "White-label reports are available on Agency tier and above.",
      upgradeRequired: true,
    });
  }

  const plan = await db.query.marketingPlans.findFirst({
    where: and(
      eq(marketingPlans.id, req.params.planId!),
      eq(marketingPlans.organizationId, req.user.orgId),
    ),
  });

  if (!plan) return res.status(404).json({ error: "Plan not found" });

  const brand = await db.query.brandProfiles.findFirst({
    where: eq(brandProfiles.id, plan.brandProfileId),
  });

  const posts = await db.query.scheduledPosts.findMany({
    where: and(
      eq(scheduledPosts.planId, plan.id),
      eq(scheduledPosts.organizationId, req.user.orgId),
    ),
    orderBy: (p, { asc }) => [asc(p.scheduledAt)],
  });

  const publishedPostIds = posts.filter((p) => p.status === "published").map((p) => p.id);

  const analytics =
    publishedPostIds.length > 0
      ? await db.query.postAnalytics.findMany({
          where: (pa, { inArray }) => inArray(pa.postId, publishedPostIds),
        })
      : [];

  const analyticsMap = new Map(analytics.map((a) => [a.postId, a]));

  // Build CSV rows
  const header = [
    "post_id",
    "brand",
    "platform",
    "content_type",
    "scheduled_at",
    "published_at",
    "status",
    "likes",
    "reposts",
    "comments",
    "impressions",
    "clicks",
    "engagement_rate",
    "content_preview",
  ].join(",");

  const escape = (v: string | null | undefined) => {
    if (v == null) return "";
    const s = String(v).replace(/"/g, '""');
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
  };

  const rows = posts.map((post) => {
    const a = analyticsMap.get(post.id);
    return [
      escape(post.id),
      escape(brand?.name),
      escape(post.platform),
      escape(post.contentType),
      escape(post.scheduledAt.toISOString()),
      escape(post.publishedAt?.toISOString()),
      escape(post.status),
      a?.likes ?? 0,
      a?.reposts ?? 0,
      a?.comments ?? 0,
      a?.impressions ?? 0,
      a?.clicks ?? 0,
      a?.engagementRate ?? "",
      escape(post.contentText.slice(0, 120)),
    ].join(",");
  });

  const csv = [header, ...rows].join("\n");
  const filename = `plan-${plan.id}-report.csv`;

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  return res.send(csv);
});

// GET /reports/brand/:brandId — Cross-plan CSV summary for a brand
router.get("/brand/:brandId", auth, async (req, res) => {
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.organizationId, req.user.orgId),
  });
  const tier = sub ? await db.query.planTiers.findFirst({ where: eq(planTiers.tier, sub.tier) }) : null;

  if (!tier?.whiteLabel) {
    return res.status(403).json({
      error: "White-label reports are available on Agency tier and above.",
      upgradeRequired: true,
    });
  }

  const brand = await db.query.brandProfiles.findFirst({
    where: and(
      eq(brandProfiles.id, req.params.brandId!),
      eq(brandProfiles.organizationId, req.user.orgId),
    ),
  });

  if (!brand) return res.status(404).json({ error: "Brand not found" });

  const posts = await db.query.scheduledPosts.findMany({
    where: and(
      eq(scheduledPosts.brandProfileId, brand.id),
      eq(scheduledPosts.organizationId, req.user.orgId),
      eq(scheduledPosts.status, "published"),
    ),
    orderBy: (p, { asc }) => [asc(p.publishedAt)],
  });

  const postIds = posts.map((p) => p.id);
  const analytics =
    postIds.length > 0
      ? await db.query.postAnalytics.findMany({
          where: (pa, { inArray }) => inArray(pa.postId, postIds),
        })
      : [];

  const analyticsMap = new Map(analytics.map((a) => [a.postId, a]));

  const header = [
    "post_id",
    "platform",
    "content_type",
    "published_at",
    "likes",
    "reposts",
    "comments",
    "impressions",
    "engagement_rate",
  ].join(",");

  const escape = (v: string | null | undefined) => {
    if (v == null) return "";
    const s = String(v).replace(/"/g, '""');
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
  };

  const rows = posts.map((post) => {
    const a = analyticsMap.get(post.id);
    return [
      escape(post.id),
      escape(post.platform),
      escape(post.contentType),
      escape(post.publishedAt?.toISOString()),
      a?.likes ?? 0,
      a?.reposts ?? 0,
      a?.comments ?? 0,
      a?.impressions ?? 0,
      a?.engagementRate ?? "",
    ].join(",");
  });

  const csv = [header, ...rows].join("\n");
  const filename = `brand-${brand.name.toLowerCase().replace(/\s+/g, "-")}-report.csv`;

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  return res.send(csv);
});

export { router as reportsRouter };
