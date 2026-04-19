import { Router } from "express";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client";
import { campaigns, marketingPlans, scheduledPosts, postAnalytics } from "../db/schema";
import { auth } from "../middleware/auth";

const router = Router();

const CreateCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  goals: z.array(z.string()).optional(),
  budgetCapCents: z.number().int().positive().optional(),
});

const UpdateCampaignSchema = CreateCampaignSchema.partial();

// GET /campaigns
router.get("/", auth, async (req, res) => {
  const list = await db.query.campaigns.findMany({
    where: eq(campaigns.organizationId, req.user.orgId),
    orderBy: (c, { desc }) => [desc(c.createdAt)],
  });
  return res.json(list);
});

// POST /campaigns
router.post("/", auth, async (req, res) => {
  const parsed = CreateCampaignSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });

  const [campaign] = await db
    .insert(campaigns)
    .values({
      organizationId: req.user.orgId,
      name: parsed.data.name,
      goals: parsed.data.goals ?? [],
      budgetCapCents: parsed.data.budgetCapCents ?? null,
    })
    .returning();

  return res.status(201).json(campaign);
});

// GET /campaigns/:id
router.get("/:id", auth, async (req, res) => {
  const campaign = await db.query.campaigns.findFirst({
    where: and(eq(campaigns.id, req.params.id!), eq(campaigns.organizationId, req.user.orgId)),
  });
  if (!campaign) return res.status(404).json({ error: "Not found" });
  return res.json(campaign);
});

// PATCH /campaigns/:id
router.patch("/:id", auth, async (req, res) => {
  const parsed = UpdateCampaignSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Validation failed" });

  const [updated] = await db
    .update(campaigns)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(campaigns.id, req.params.id!), eq(campaigns.organizationId, req.user.orgId)))
    .returning();

  if (!updated) return res.status(404).json({ error: "Not found" });
  return res.json(updated);
});

// DELETE /campaigns/:id
router.delete("/:id", auth, async (req, res) => {
  await db
    .delete(campaigns)
    .where(and(eq(campaigns.id, req.params.id!), eq(campaigns.organizationId, req.user.orgId)));
  return res.json({ ok: true });
});

// GET /campaigns/:id/analytics — rollup view across all plans in this campaign
router.get("/:id/analytics", auth, async (req, res) => {
  const campaign = await db.query.campaigns.findFirst({
    where: and(eq(campaigns.id, req.params.id!), eq(campaigns.organizationId, req.user.orgId)),
  });
  if (!campaign) return res.status(404).json({ error: "Not found" });

  // All plans under this campaign
  const plans = await db.query.marketingPlans.findMany({
    where: and(
      eq(marketingPlans.campaignId, campaign.id),
      eq(marketingPlans.organizationId, req.user.orgId),
    ),
  });

  const planIds = plans.map((p) => p.id);
  if (planIds.length === 0) {
    return res.json({ campaign, plans: [], totals: { posts: 0, published: 0, failed: 0, totalLikes: 0, totalImpressions: 0 } });
  }

  // Aggregate post stats across all plans in this campaign
  const posts = await db.query.scheduledPosts.findMany({
    where: and(
      eq(scheduledPosts.organizationId, req.user.orgId),
      // Drizzle doesn't support inArray with dynamic planIds well in all versions,
      // so we filter in JS for the rollup view
    ),
  });

  const campaignPosts = posts.filter((p) => planIds.includes(p.planId));
  const publishedPostIds = campaignPosts.filter((p) => p.status === "published").map((p) => p.id);

  const analytics = publishedPostIds.length > 0
    ? await db.query.postAnalytics.findMany({
        where: (pa, { inArray }) => inArray(pa.postId, publishedPostIds),
      })
    : [];

  const analyticsMap = new Map(analytics.map((a) => [a.postId, a]));

  const totals = {
    posts: campaignPosts.length,
    published: campaignPosts.filter((p) => p.status === "published").length,
    failed: campaignPosts.filter((p) => p.status === "failed").length,
    vetoed: campaignPosts.filter((p) => p.status === "vetoed").length,
    totalLikes: analytics.reduce((a, r) => a + (r.likes ?? 0), 0),
    totalReposts: analytics.reduce((a, r) => a + (r.reposts ?? 0), 0),
    totalComments: analytics.reduce((a, r) => a + (r.comments ?? 0), 0),
    totalImpressions: analytics.reduce((a, r) => a + (r.impressions ?? 0), 0),
    avgEngagementRate: analytics.length
      ? (analytics.reduce((a, r) => a + parseFloat(r.engagementRate ?? "0"), 0) / analytics.length)
      : 0,
  };

  // Per-platform breakdown — group published posts by platform
  const byPlatform: Record<string, { published: number; likes: number; impressions: number; engagementRate: number }> = {};
  for (const post of campaignPosts.filter((p) => p.status === "published")) {
    const a = analyticsMap.get(post.id);
    const plat = post.platform;
    if (!byPlatform[plat]) byPlatform[plat] = { published: 0, likes: 0, impressions: 0, engagementRate: 0 };
    byPlatform[plat].published++;
    byPlatform[plat].likes += a?.likes ?? 0;
    byPlatform[plat].impressions += a?.impressions ?? 0;
    byPlatform[plat].engagementRate += parseFloat(a?.engagementRate ?? "0");
  }
  // Average the engagement rate per platform
  for (const plat of Object.keys(byPlatform)) {
    const count = byPlatform[plat].published;
    if (count > 0) byPlatform[plat].engagementRate /= count;
  }

  return res.json({ campaign, plans, totals, byPlatform });
});

export { router as campaignsRouter };
