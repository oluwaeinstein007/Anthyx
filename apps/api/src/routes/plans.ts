import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../db/client";
import { marketingPlans, scheduledPosts, brandProfiles, agents } from "../db/schema";
import { auth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { GeneratePlanSchema } from "@anthyx/config";
import { queuePlanGeneration } from "../queue/jobs";

const router = Router();

// POST /plans/generate
router.post("/generate", auth, validate(GeneratePlanSchema), async (req, res) => {
  const { brandProfileId, agentId, platforms, goals, startDate, feedbackLoopEnabled } = req.body;

  const brand = await db.query.brandProfiles.findFirst({
    where: and(
      eq(brandProfiles.id, brandProfileId),
      eq(brandProfiles.organizationId, req.user.orgId),
    ),
  });
  if (!brand) return res.status(404).json({ error: "Brand not found" });

  const start = new Date(startDate);
  const end = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [plan] = await db
    .insert(marketingPlans)
    .values({
      organizationId: req.user.orgId,
      brandProfileId,
      agentId,
      name: `${brand.name} — 30-day plan (${start.toLocaleDateString()})`,
      status: "generating",
      startDate: start,
      endDate: end,
      goals,
      feedbackLoopEnabled: feedbackLoopEnabled ?? false,
    })
    .returning();

  // Kick off async plan generation
  await queuePlanGeneration(plan!.id, req.user.orgId);

  return res.status(202).json({ plan, message: "Plan generation queued" });
});

// GET /plans
router.get("/", auth, async (req, res) => {
  const plans = await db.query.marketingPlans.findMany({
    where: eq(marketingPlans.organizationId, req.user.orgId),
  });
  return res.json(plans);
});

// GET /plans/:id
router.get("/:id", auth, async (req, res) => {
  const plan = await db.query.marketingPlans.findFirst({
    where: and(
      eq(marketingPlans.id, req.params.id!),
      eq(marketingPlans.organizationId, req.user.orgId),
    ),
  });
  if (!plan) return res.status(404).json({ error: "Not found" });

  const posts = await db.query.scheduledPosts.findMany({
    where: eq(scheduledPosts.planId, plan.id),
  });

  return res.json({ ...plan, posts });
});

// PUT /plans/:id
router.put("/:id", auth, async (req, res) => {
  const [updated] = await db
    .update(marketingPlans)
    .set({ ...req.body, updatedAt: new Date() })
    .where(
      and(
        eq(marketingPlans.id, req.params.id!),
        eq(marketingPlans.organizationId, req.user.orgId),
      ),
    )
    .returning();

  if (!updated) return res.status(404).json({ error: "Not found" });
  return res.json(updated);
});

// POST /plans/:id/approve
router.post("/:id/approve", auth, async (req, res) => {
  const plan = await db.query.marketingPlans.findFirst({
    where: and(
      eq(marketingPlans.id, req.params.id!),
      eq(marketingPlans.organizationId, req.user.orgId),
    ),
  });
  if (!plan) return res.status(404).json({ error: "Not found" });

  await db
    .update(marketingPlans)
    .set({ status: "active", updatedAt: new Date() })
    .where(eq(marketingPlans.id, plan.id));

  return res.json({ approved: true });
});

// POST /plans/:id/pause
router.post("/:id/pause", auth, async (req, res) => {
  await db
    .update(marketingPlans)
    .set({ status: "paused", updatedAt: new Date() })
    .where(
      and(
        eq(marketingPlans.id, req.params.id!),
        eq(marketingPlans.organizationId, req.user.orgId),
      ),
    );
  return res.json({ paused: true });
});

export { router as plansRouter };
