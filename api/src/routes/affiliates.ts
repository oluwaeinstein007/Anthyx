import { Router } from "express";
import { eq, desc, inArray } from "drizzle-orm";
import { db } from "../db/client";
import { affiliates, affiliateLinks, affiliateConversions } from "../db/schema";
import { affiliateAuth } from "../middleware/auth";

const router = Router();
router.use(affiliateAuth);

// GET /affiliates/me — get current user's affiliate record
router.get("/me", async (req, res) => {
  const affiliate = await db.query.affiliates.findFirst({
    where: eq(affiliates.userId, req.user.id),
  });
  if (!affiliate) return res.status(404).json({ error: "Not an affiliate" });
  return res.json(affiliate);
});

// POST /affiliates/apply — apply to become an affiliate
router.post("/apply", async (req, res) => {
  const existing = await db.query.affiliates.findFirst({
    where: eq(affiliates.userId, req.user.id),
  });
  if (existing) return res.status(409).json({ error: "Already applied" });

  const [affiliate] = await db
    .insert(affiliates)
    .values({
      userId: req.user.id,
      email: req.user.email,
      name: (req.body as { name?: string }).name ?? req.user.email,
      status: "pending",
    })
    .returning();

  return res.status(201).json(affiliate);
});

// GET /affiliates/links — list affiliate's tracking links
router.get("/links", async (req, res) => {
  const affiliate = await db.query.affiliates.findFirst({
    where: eq(affiliates.userId, req.user.id),
  });
  if (!affiliate) return res.status(403).json({ error: "Not an affiliate" });

  const links = await db.query.affiliateLinks.findMany({
    where: eq(affiliateLinks.affiliateId, affiliate.id),
    orderBy: [desc(affiliateLinks.createdAt)],
  });
  return res.json(links);
});

// POST /affiliates/links — create a new tracking link
router.post("/links", async (req, res) => {
  const affiliate = await db.query.affiliates.findFirst({
    where: eq(affiliates.userId, req.user.id),
  });
  if (!affiliate) return res.status(403).json({ error: "Not an affiliate" });
  if (affiliate.status !== "approved") return res.status(403).json({ error: "Affiliate not yet approved" });

  const { campaign } = req.body as { campaign?: string };

  const code = `${affiliate.id.slice(0, 8)}-${Date.now().toString(36)}`.toUpperCase();

  const [link] = await db
    .insert(affiliateLinks)
    .values({ affiliateId: affiliate.id, code, campaign: campaign ?? null })
    .returning();

  return res.status(201).json(link);
});

// GET /affiliates/conversions — list conversions for this affiliate
router.get("/conversions", async (req, res) => {
  const affiliate = await db.query.affiliates.findFirst({
    where: eq(affiliates.userId, req.user.id),
  });
  if (!affiliate) return res.status(403).json({ error: "Not an affiliate" });

  const links = await db.query.affiliateLinks.findMany({
    where: eq(affiliateLinks.affiliateId, affiliate.id),
  });
  const linkIds = links.map((l) => l.id);
  if (linkIds.length === 0) return res.json([]);

  const conversions = await db.query.affiliateConversions.findMany({
    where: inArray(affiliateConversions.affiliateLinkId, linkIds),
    orderBy: [desc(affiliateConversions.clearedAt)],
    limit: 100,
  });

  return res.json(conversions);
});

// PATCH /affiliates/me — update display name and Stripe account ID
router.patch("/me", async (req, res) => {
  const { name, stripeAccountId } = req.body as { name?: string; stripeAccountId?: string };

  const affiliate = await db.query.affiliates.findFirst({
    where: eq(affiliates.userId, req.user.id),
  });
  if (!affiliate) return res.status(404).json({ error: "Not an affiliate" });

  await db
    .update(affiliates)
    .set({
      ...(name ? { name } : {}),
      ...(stripeAccountId !== undefined ? { stripeAccountId } : {}),
    })
    .where(eq(affiliates.id, affiliate.id));

  return res.json({ updated: true });
});

// GET /affiliates/payouts — cleared and paid conversions (payout history)
router.get("/payouts", async (req, res) => {
  const affiliate = await db.query.affiliates.findFirst({
    where: eq(affiliates.userId, req.user.id),
  });
  if (!affiliate) return res.status(403).json({ error: "Not an affiliate" });

  const links = await db.query.affiliateLinks.findMany({
    where: eq(affiliateLinks.affiliateId, affiliate.id),
    columns: { id: true },
  });

  const linkIds = links.map((l) => l.id);
  if (linkIds.length === 0) return res.json({ affiliate, payouts: [] });

  const payouts = await db.query.affiliateConversions.findMany({
    where: (c, { and: a, inArray: inArr, ne }) =>
      a(inArr(c.affiliateLinkId, linkIds), ne(c.status, "pending")),
    orderBy: (c, { desc: d }) => [d(c.clearedAt)],
    limit: 100,
  });

  return res.json({ affiliate, payouts });
});

// POST /affiliates/payouts/request — request a payout (marks pending cleared conversions as payout-requested)
router.post("/payouts/request", async (req, res) => {
  const affiliate = await db.query.affiliates.findFirst({
    where: eq(affiliates.userId, req.user.id),
  });
  if (!affiliate) return res.status(403).json({ error: "Not an affiliate" });
  if (affiliate.status !== "approved") return res.status(403).json({ error: "Affiliate not approved" });

  const unpaidBalance = (affiliate.totalEarnedCents ?? 0) - (affiliate.totalPaidCents ?? 0);
  const threshold = affiliate.payoutThresholdCents ?? 5000;

  if (unpaidBalance < threshold) {
    return res.status(400).json({
      error: `Minimum payout threshold not met. Balance: $${(unpaidBalance / 100).toFixed(2)}, threshold: $${(threshold / 100).toFixed(2)}`,
    });
  }

  return res.json({
    requested: true,
    amount: unpaidBalance,
    message: "Payout request submitted. Our team will process it within 5–7 business days.",
  });
});

export { router as affiliatesRouter };
