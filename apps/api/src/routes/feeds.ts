import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../db/client";
import { rssFeeds, feedItems, brandProfiles } from "../db/schema";
import { auth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { CreateRssFeedSchema } from "@anthyx/config";

const router = Router();

// GET /brands/:brandId/feeds
router.get("/:brandId/feeds", auth, async (req, res) => {
  const brand = await db.query.brandProfiles.findFirst({
    where: and(
      eq(brandProfiles.id, req.params.brandId!),
      eq(brandProfiles.organizationId, req.user.orgId),
    ),
  });
  if (!brand) return res.status(404).json({ error: "Brand not found" });

  const feeds = await db.query.rssFeeds.findMany({
    where: and(
      eq(rssFeeds.organizationId, req.user.orgId),
      eq(rssFeeds.brandProfileId, brand.id),
    ),
    orderBy: [desc(rssFeeds.createdAt)],
  });

  return res.json(feeds);
});

// POST /brands/:brandId/feeds — register a new RSS feed
router.post("/:brandId/feeds", auth, validate(CreateRssFeedSchema), async (req, res) => {
  const brand = await db.query.brandProfiles.findFirst({
    where: and(
      eq(brandProfiles.id, req.params.brandId!),
      eq(brandProfiles.organizationId, req.user.orgId),
    ),
  });
  if (!brand) return res.status(404).json({ error: "Brand not found" });

  const { feedUrl, label } = req.body;

  const [feed] = await db
    .insert(rssFeeds)
    .values({
      organizationId: req.user.orgId,
      brandProfileId: brand.id,
      feedUrl,
      label,
    })
    .returning();

  return res.status(201).json(feed);
});

// DELETE /brands/:brandId/feeds/:feedId
router.delete("/:brandId/feeds/:feedId", auth, async (req, res) => {
  const feed = await db.query.rssFeeds.findFirst({
    where: and(
      eq(rssFeeds.id, req.params.feedId!),
      eq(rssFeeds.organizationId, req.user.orgId),
    ),
  });
  if (!feed) return res.status(404).json({ error: "Feed not found" });

  await db.delete(feedItems).where(eq(feedItems.rssFeedId, feed.id));
  await db.delete(rssFeeds).where(eq(rssFeeds.id, feed.id));

  return res.json({ deleted: true });
});

// GET /brands/:brandId/feeds/items — recent feed items for a brand
router.get("/:brandId/feeds/items", auth, async (req, res) => {
  const { flaggedOnly, limit: limitStr } = req.query as { flaggedOnly?: string; limit?: string };
  const limit = Math.min(parseInt(limitStr ?? "50"), 200);

  const brand = await db.query.brandProfiles.findFirst({
    where: and(
      eq(brandProfiles.id, req.params.brandId!),
      eq(brandProfiles.organizationId, req.user.orgId),
    ),
  });
  if (!brand) return res.status(404).json({ error: "Brand not found" });

  const brandFeeds = await db.query.rssFeeds.findMany({
    where: and(
      eq(rssFeeds.organizationId, req.user.orgId),
      eq(rssFeeds.brandProfileId, brand.id),
    ),
    columns: { id: true },
  });

  if (brandFeeds.length === 0) return res.json([]);

  const { inArray } = await import("drizzle-orm");
  const feedIds = brandFeeds.map((f) => f.id);

  const conditions = [
    inArray(feedItems.rssFeedId, feedIds),
    ...(flaggedOnly === "true" ? [eq(feedItems.isFlagged, true)] : []),
  ];

  const items = await db.query.feedItems.findMany({
    where: and(...(conditions as [ReturnType<typeof eq>, ...ReturnType<typeof eq>[]])),
    orderBy: [desc(feedItems.publishedAt)],
    limit,
  });

  return res.json(items);
});

export { router as feedsRouter };
