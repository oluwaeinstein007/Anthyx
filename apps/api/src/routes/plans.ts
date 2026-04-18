import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../db/client";
import { marketingPlans, scheduledPosts, brandProfiles, agents, socialAccounts } from "../db/schema";
import { auth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { GeneratePlanSchema } from "@anthyx/config";
import { queuePlanGeneration } from "../queue/jobs";

const router = Router();

// POST /plans/generate
router.post("/generate", auth, validate(GeneratePlanSchema), async (req, res) => {
  const { brandProfileId, agentId, platforms, goals, startDate, feedbackLoopEnabled, durationDays = 30 } = req.body;

  const brand = await db.query.brandProfiles.findFirst({
    where: and(
      eq(brandProfiles.id, brandProfileId),
      eq(brandProfiles.organizationId, req.user.orgId),
    ),
  });
  if (!brand) return res.status(404).json({ error: "Brand not found" });

  const agent = await db.query.agents.findFirst({
    where: and(eq(agents.id, agentId), eq(agents.organizationId, req.user.orgId)),
  });
  if (!agent) return res.status(404).json({ error: "Agent not found" });
  if (!agent.isActive) return res.status(400).json({ error: "Agent is silenced and cannot generate plans" });

  // Resolve social accounts for the requested platforms (one per platform)
  const accounts = await db.query.socialAccounts.findMany({
    where: and(
      eq(socialAccounts.agentId, agentId),
      eq(socialAccounts.isActive, true),
    ),
  });

  const validPlatforms: string[] = [];
  const socialAccountIds: string[] = [];
  for (const platform of platforms as string[]) {
    const acct = accounts.find((a) => a.platform === platform);
    validPlatforms.push(platform);
    socialAccountIds.push(acct?.id ?? "");
  }

  const start = new Date(startDate);
  const end = new Date(start.getTime() + durationDays * 24 * 60 * 60 * 1000);

  const [plan] = await db
    .insert(marketingPlans)
    .values({
      organizationId: req.user.orgId,
      brandProfileId,
      agentId,
      name: `${brand.name} — ${durationDays}-day plan (${start.toLocaleDateString()})`,
      status: "generating",
      startDate: start,
      endDate: end,
      goals,
      feedbackLoopEnabled: feedbackLoopEnabled ?? false,
    })
    .returning();

  await queuePlanGeneration({
    planId: plan!.id,
    organizationId: req.user.orgId,
    brandProfileId,
    brandName: brand.name,
    industry: brand.industry ?? "",
    goals,
    platforms: validPlatforms,
    agentId,
    socialAccountIds,
    durationDays,
    feedbackLoopEnabled: feedbackLoopEnabled ?? false,
  });

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

// PUT /plans/:id — update plan metadata only
router.put("/:id", auth, async (req, res) => {
  const plan = await db.query.marketingPlans.findFirst({
    where: and(
      eq(marketingPlans.id, req.params.id!),
      eq(marketingPlans.organizationId, req.user.orgId),
    ),
  });
  if (!plan) return res.status(404).json({ error: "Not found" });

  const { name, goals, feedbackLoopEnabled } = req.body as {
    name?: string;
    goals?: string[];
    feedbackLoopEnabled?: boolean;
  };

  const [updated] = await db
    .update(marketingPlans)
    .set({
      ...(name !== undefined && { name }),
      ...(goals !== undefined && { goals }),
      ...(feedbackLoopEnabled !== undefined && { feedbackLoopEnabled }),
      updatedAt: new Date(),
    })
    .where(eq(marketingPlans.id, plan.id))
    .returning();

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
  if (plan.status !== "pending_review") {
    return res.status(400).json({ error: "Plan is not pending review" });
  }

  await db
    .update(marketingPlans)
    .set({ status: "active", updatedAt: new Date() })
    .where(eq(marketingPlans.id, plan.id));

  return res.json({ approved: true });
});

// POST /plans/:id/retry
router.post("/:id/retry", auth, async (req, res) => {
  const plan = await db.query.marketingPlans.findFirst({
    where: and(
      eq(marketingPlans.id, req.params.id!),
      eq(marketingPlans.organizationId, req.user.orgId),
    ),
  });
  if (!plan) return res.status(404).json({ error: "Not found" });
  if (plan.status !== "failed") {
    return res.status(400).json({ error: "Only failed plans can be retried" });
  }

  const [brand, accounts] = await Promise.all([
    db.query.brandProfiles.findFirst({ where: eq(brandProfiles.id, plan.brandProfileId) }),
    db.query.socialAccounts.findMany({
      where: and(eq(socialAccounts.agentId, plan.agentId), eq(socialAccounts.isActive, true)),
    }),
  ]);

  const platformAccountMap: Record<string, string> = {};
  for (const acct of accounts) {
    platformAccountMap[acct.platform] = acct.id;
  }
  const allPlatforms = [...new Set(accounts.map((a) => a.platform))];

  const durationDays = Math.round(
    (plan.endDate.getTime() - plan.startDate.getTime()) / (24 * 60 * 60 * 1000),
  );

  await db
    .update(marketingPlans)
    .set({ status: "generating", updatedAt: new Date() })
    .where(eq(marketingPlans.id, plan.id));

  await queuePlanGeneration({
    planId: plan.id,
    organizationId: req.user.orgId,
    brandProfileId: plan.brandProfileId,
    brandName: brand?.name ?? "",
    industry: brand?.industry ?? "",
    goals: plan.goals as string[],
    platforms: allPlatforms,
    agentId: plan.agentId,
    socialAccountIds: allPlatforms.map((p) => platformAccountMap[p] ?? ""),
    durationDays,
    feedbackLoopEnabled: plan.feedbackLoopEnabled,
  });

  return res.json({ retrying: true });
});

// POST /plans/:id/pause
router.post("/:id/pause", auth, async (req, res) => {
  const plan = await db.query.marketingPlans.findFirst({
    where: and(
      eq(marketingPlans.id, req.params.id!),
      eq(marketingPlans.organizationId, req.user.orgId),
    ),
  });
  if (!plan) return res.status(404).json({ error: "Not found" });
  if (plan.status !== "active") {
    return res.status(400).json({ error: "Only active plans can be paused" });
  }

  await db
    .update(marketingPlans)
    .set({ status: "paused", updatedAt: new Date() })
    .where(eq(marketingPlans.id, plan.id));
  return res.json({ paused: true });
});

// POST /plans/:id/resume
router.post("/:id/resume", auth, async (req, res) => {
  const plan = await db.query.marketingPlans.findFirst({
    where: and(
      eq(marketingPlans.id, req.params.id!),
      eq(marketingPlans.organizationId, req.user.orgId),
    ),
  });
  if (!plan) return res.status(404).json({ error: "Not found" });
  if (plan.status !== "paused") {
    return res.status(400).json({ error: "Plan is not paused" });
  }

  await db
    .update(marketingPlans)
    .set({ status: "active", updatedAt: new Date() })
    .where(eq(marketingPlans.id, plan.id));
  return res.json({ resumed: true });
});

export { router as plansRouter };
