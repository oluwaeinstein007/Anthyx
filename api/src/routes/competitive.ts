import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../db/client";
import { brandProfiles, competitors, competitorAnalyses } from "../db/schema";
import { auth } from "../middleware/auth";
import { generateCompetitiveAnalysis } from "../services/agent/competitive-analyst";

const router = Router();

// ── Competitors CRUD ───────────────────────────────────────────────────────────

// GET /brands/:brandId/competitors
router.get("/:brandId/competitors", auth, async (req, res) => {
  const brand = await db.query.brandProfiles.findFirst({
    where: and(eq(brandProfiles.id, req.params.brandId!), eq(brandProfiles.organizationId, req.user.orgId)),
  });
  if (!brand) return res.status(404).json({ error: "Brand not found" });

  const list = await db.query.competitors.findMany({
    where: eq(competitors.brandProfileId, brand.id),
    orderBy: [desc(competitors.createdAt)],
  });
  return res.json(list);
});

// POST /brands/:brandId/competitors
router.post("/:brandId/competitors", auth, async (req, res) => {
  const brand = await db.query.brandProfiles.findFirst({
    where: and(eq(brandProfiles.id, req.params.brandId!), eq(brandProfiles.organizationId, req.user.orgId)),
  });
  if (!brand) return res.status(404).json({ error: "Brand not found" });

  const { name, websiteUrl, socialHandles, tier, notes } = req.body as {
    name: string;
    websiteUrl?: string;
    socialHandles?: Record<string, string>;
    tier?: "direct" | "indirect" | "aspirational";
    notes?: string;
  };

  if (!name?.trim()) return res.status(400).json({ error: "name is required" });

  const [competitor] = await db
    .insert(competitors)
    .values({
      organizationId: req.user.orgId,
      brandProfileId: brand.id,
      name: name.trim(),
      websiteUrl: websiteUrl ?? null,
      socialHandles: socialHandles ?? null,
      tier: tier ?? "direct",
      notes: notes ?? null,
    })
    .returning();

  return res.status(201).json(competitor);
});

// PATCH /brands/:brandId/competitors/:competitorId
router.patch("/:brandId/competitors/:competitorId", auth, async (req, res) => {
  const brand = await db.query.brandProfiles.findFirst({
    where: and(eq(brandProfiles.id, req.params.brandId!), eq(brandProfiles.organizationId, req.user.orgId)),
  });
  if (!brand) return res.status(404).json({ error: "Brand not found" });

  const { name, websiteUrl, socialHandles, tier, status, notes } = req.body as {
    name?: string;
    websiteUrl?: string;
    socialHandles?: Record<string, string>;
    tier?: "direct" | "indirect" | "aspirational";
    status?: "active" | "inactive" | "new";
    notes?: string;
  };

  const [updated] = await db
    .update(competitors)
    .set({
      ...(name !== undefined && { name }),
      ...(websiteUrl !== undefined && { websiteUrl }),
      ...(socialHandles !== undefined && { socialHandles }),
      ...(tier !== undefined && { tier }),
      ...(status !== undefined && { status }),
      ...(notes !== undefined && { notes }),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(competitors.id, req.params.competitorId!),
        eq(competitors.brandProfileId, brand.id),
      ),
    )
    .returning();

  if (!updated) return res.status(404).json({ error: "Competitor not found" });
  return res.json(updated);
});

// DELETE /brands/:brandId/competitors/:competitorId
router.delete("/:brandId/competitors/:competitorId", auth, async (req, res) => {
  const brand = await db.query.brandProfiles.findFirst({
    where: and(eq(brandProfiles.id, req.params.brandId!), eq(brandProfiles.organizationId, req.user.orgId)),
  });
  if (!brand) return res.status(404).json({ error: "Brand not found" });

  await db
    .delete(competitors)
    .where(
      and(
        eq(competitors.id, req.params.competitorId!),
        eq(competitors.brandProfileId, brand.id),
      ),
    );

  return res.json({ deleted: true });
});

// ── Competitive Analysis ───────────────────────────────────────────────────────

// GET /brands/:brandId/competitive-intelligence — get latest analysis
router.get("/:brandId/competitive-intelligence", auth, async (req, res) => {
  const brand = await db.query.brandProfiles.findFirst({
    where: and(eq(brandProfiles.id, req.params.brandId!), eq(brandProfiles.organizationId, req.user.orgId)),
  });
  if (!brand) return res.status(404).json({ error: "Brand not found" });

  const analysis = await db.query.competitorAnalyses.findFirst({
    where: eq(competitorAnalyses.brandProfileId, brand.id),
    orderBy: [desc(competitorAnalyses.generatedAt)],
  });

  const competitorList = await db.query.competitors.findMany({
    where: eq(competitors.brandProfileId, brand.id),
    orderBy: [desc(competitors.createdAt)],
  });

  return res.json({ analysis: analysis ?? null, competitors: competitorList });
});

// POST /brands/:brandId/competitive-intelligence/refresh — trigger fresh AI analysis
router.post("/:brandId/competitive-intelligence/refresh", auth, async (req, res) => {
  const brand = await db.query.brandProfiles.findFirst({
    where: and(eq(brandProfiles.id, req.params.brandId!), eq(brandProfiles.organizationId, req.user.orgId)),
  });
  if (!brand) return res.status(404).json({ error: "Brand not found" });

  const competitorList = await db.query.competitors.findMany({
    where: and(
      eq(competitors.brandProfileId, brand.id),
      eq(competitors.status, "active"),
    ),
  });

  if (competitorList.length === 0) {
    return res.status(400).json({ error: "Add at least one competitor before running analysis" });
  }

  const industry = brand.industry ?? "general";

  const result = await generateCompetitiveAnalysis(
    brand.name,
    industry,
    competitorList.map((c) => ({
      name: c.name,
      websiteUrl: c.websiteUrl,
      tier: c.tier ?? "direct",
      socialHandles: c.socialHandles as Record<string, string> | null,
    })),
  );

  const [analysis] = await db
    .insert(competitorAnalyses)
    .values({
      brandProfileId: brand.id,
      organizationId: req.user.orgId,
      industryOverview: result.industryOverview,
      contentAnalysis: result.contentAnalysis,
      engagementBenchmarks: result.engagementBenchmarks,
      gapAnalysis: result.gapAnalysis,
      shareOfVoice: result.shareOfVoice,
      sentimentAnalysis: result.sentimentAnalysis,
      benchmarkScorecard: result.benchmarkScorecard,
    })
    .returning();

  return res.status(201).json(analysis);
});

export { router as competitiveRouter };
