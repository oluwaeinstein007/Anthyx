import { Router } from "express";
import { eq, desc, and, sql } from "drizzle-orm";
import { db } from "../db/client";
import {
  organizations,
  users,
  subscriptions,
  scheduledPosts,
  promoCodes,
  featureFlags,
  affiliates,
  agents,
  planTiers,
  emailTemplates,
} from "../db/schema";
import { adminAuth, issueToken } from "../middleware/auth";
import {
  postExecutionQueue,
  planGenerationQueue,
  contentGenerationQueue,
  analyticsQueue,
  ingestorQueue,
  notificationQueue,
} from "../queue/client";

const router = Router();

// All admin routes require an admin-scoped JWT (aud: 'admin') and isSuperAdmin flag.
router.use(adminAuth);

// ── Platform stats ─────────────────────────────────────────────────────────────

// GET /admin/stats
router.get("/stats", async (_req, res) => {
  const [orgCount, userCount, postCount] = await Promise.all([
    db.select().from(organizations).then((r) => r.length),
    db.select().from(users).then((r) => r.length),
    db.query.scheduledPosts.findMany({ where: eq(scheduledPosts.status, "published") }).then((r) => r.length),
  ]);

  return res.json({ organizations: orgCount, users: userCount, postsPublished: postCount });
});

// ── Organizations ──────────────────────────────────────────────────────────────

// GET /admin/organizations
router.get("/organizations", async (req, res) => {
  const search = req.query["search"] as string | undefined;
  const orgs = await db.query.organizations.findMany({
    orderBy: [desc(organizations.createdAt)],
    limit: 100,
  });

  const filtered = search
    ? orgs.filter((o) => o.name.toLowerCase().includes(search.toLowerCase()) || o.slug.includes(search.toLowerCase()))
    : orgs;

  return res.json(filtered);
});

// GET /admin/organizations/:id
router.get("/organizations/:id", async (req, res) => {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, req.params.id!),
  });
  if (!org) return res.status(404).json({ error: "Not found" });

  const [members, sub] = await Promise.all([
    db.query.users.findMany({ where: eq(users.organizationId, org.id) }),
    db.query.subscriptions.findFirst({ where: eq(subscriptions.organizationId, org.id) }),
  ]);

  return res.json({ org, members, subscription: sub });
});

// PUT /admin/organizations/:id — update tier override or flags
router.put("/organizations/:id", async (req, res) => {
  const { tier, status } = req.body as { tier?: string; status?: string };

  if (tier) {
    await db
      .update(subscriptions)
      .set({ tier: tier as never, updatedAt: new Date() })
      .where(eq(subscriptions.organizationId, req.params.id!));
  }

  return res.json({ updated: true });
});

// ── Users ──────────────────────────────────────────────────────────────────────

// GET /admin/users
router.get("/users", async (req, res) => {
  const search = req.query["email"] as string | undefined;
  const allUsers = await db.query.users.findMany({
    orderBy: [desc(users.createdAt)],
    limit: 100,
  });

  const filtered = search
    ? allUsers.filter((u) => u.email.toLowerCase().includes(search.toLowerCase()))
    : allUsers;

  return res.json(filtered);
});

// GET /admin/users/:id
router.get("/users/:id", async (req, res) => {
  const user = await db.query.users.findFirst({ where: eq(users.id, req.params.id!) });
  if (!user) return res.status(404).json({ error: "Not found" });
  return res.json(user);
});

// POST /admin/users/:id/impersonate — issue short-lived impersonation JWT
router.post("/users/:id/impersonate", async (req, res) => {
  const target = await db.query.users.findFirst({ where: eq(users.id, req.params.id!) });
  if (!target || !target.organizationId) return res.status(404).json({ error: "User not found or has no org" });

  const token = issueToken({
    id: target.id,
    email: target.email,
    orgId: target.organizationId,
    role: target.role,
  });

  return res.json({ token, expiresIn: "1h" });
});

// ── Subscriptions ──────────────────────────────────────────────────────────────

// POST /admin/subscriptions/:id/override
router.post("/subscriptions/:id/override", async (req, res) => {
  const { tier, trialDays } = req.body as { tier?: string; trialDays?: number };

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (tier) updates["tier"] = tier;
  if (trialDays) updates["trialEndsAt"] = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);

  await db.update(subscriptions).set(updates as never).where(eq(subscriptions.id, req.params.id!));
  return res.json({ updated: true });
});

// ── Feature Flags ──────────────────────────────────────────────────────────────

// GET /admin/feature-flags
router.get("/feature-flags", async (_req, res) => {
  const flags = await db.select().from(featureFlags);
  return res.json(flags);
});

// PUT /admin/feature-flags/:flag
router.put("/feature-flags/:flag", async (req, res) => {
  const { enabledGlobally, enabledForOrgs, disabledForOrgs } = req.body as {
    enabledGlobally?: boolean;
    enabledForOrgs?: string[];
    disabledForOrgs?: string[];
  };

  const existing = await db.query.featureFlags.findFirst({
    where: eq(featureFlags.flagName, req.params.flag!),
  });

  if (existing) {
    await db
      .update(featureFlags)
      .set({
        ...(enabledGlobally !== undefined && { enabledGlobally }),
        ...(enabledForOrgs !== undefined && { enabledForOrgs }),
        ...(disabledForOrgs !== undefined && { disabledForOrgs }),
      })
      .where(eq(featureFlags.flagName, req.params.flag!));
  } else {
    await db.insert(featureFlags).values({
      flagName: req.params.flag!,
      enabledGlobally: enabledGlobally ?? false,
      enabledForOrgs: enabledForOrgs ?? [],
      disabledForOrgs: disabledForOrgs ?? [],
    });
  }

  return res.json({ updated: true });
});

// ── Promo Codes ────────────────────────────────────────────────────────────────

// GET /admin/promo-codes
router.get("/promo-codes", async (_req, res) => {
  const codes = await db.query.promoCodes.findMany({ orderBy: [desc(promoCodes.createdAt)] });
  return res.json(codes);
});

// POST /admin/promo-codes
router.post("/promo-codes", async (req, res) => {
  const { code, discountType, discountValue, applicableTiers, maxUses, expiresAt } = req.body as {
    code: string;
    discountType: string;
    discountValue: number;
    applicableTiers?: string[];
    maxUses?: number;
    expiresAt?: string;
  };

  if (!code || !discountType || discountValue === undefined) {
    return res.status(400).json({ error: "code, discountType, and discountValue are required" });
  }

  const [promo] = await db
    .insert(promoCodes)
    .values({
      code: code.toUpperCase(),
      discountType,
      discountValue,
      applicableTiers: applicableTiers ?? null,
      maxUses: maxUses ?? null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    })
    .returning();

  return res.status(201).json(promo);
});

// PATCH /admin/promo-codes/:id
router.patch("/promo-codes/:id", async (req, res) => {
  const { isActive, maxUses, expiresAt } = req.body as {
    isActive?: boolean;
    maxUses?: number;
    expiresAt?: string;
  };

  await db
    .update(promoCodes)
    .set({
      ...(isActive !== undefined && { isActive }),
      ...(maxUses !== undefined && { maxUses }),
      ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
    })
    .where(eq(promoCodes.id, req.params.id!));

  return res.json({ updated: true });
});

// ── Affiliates ─────────────────────────────────────────────────────────────────

// GET /admin/affiliates
router.get("/affiliates", async (_req, res) => {
  const all = await db.query.affiliates.findMany({ orderBy: [desc(affiliates.createdAt)] });
  return res.json(all);
});

// PUT /admin/affiliates/:id
router.put("/affiliates/:id", async (req, res) => {
  const { status, commissionRate } = req.body as { status?: string; commissionRate?: string };

  await db
    .update(affiliates)
    .set({
      ...(status !== undefined && { status: status as never }),
      ...(commissionRate !== undefined && { commissionRate }),
    })
    .where(eq(affiliates.id, req.params.id!));

  return res.json({ updated: true });
});

// ── Posts (admin view) ─────────────────────────────────────────────────────────

// GET /admin/posts
router.get("/posts", async (req, res) => {
  const posts = await db.query.scheduledPosts.findMany({
    orderBy: [desc(scheduledPosts.createdAt)],
    limit: 100,
  });
  return res.json(posts);
});

// ── Billing (admin view) ───────────────────────────────────────────────────────

// GET /admin/billing — list all subscriptions with org info
router.get("/billing", async (_req, res) => {
  const subs = await db.query.subscriptions.findMany({
    orderBy: [desc(subscriptions.createdAt)],
    limit: 200,
  });

  // Attach org names
  const orgIds = [...new Set(subs.map((s) => s.organizationId))];
  const orgs = orgIds.length > 0
    ? await db.query.organizations.findMany({
        where: (o, { inArray }) => inArray(o.id, orgIds),
      })
    : [];

  const orgMap = new Map(orgs.map((o) => [o.id, o]));

  const result = subs.map((s) => ({
    ...s,
    organization: orgMap.get(s.organizationId) ?? null,
  }));

  return res.json(result);
});

// GET /admin/billing/invoices — aggregate billing stats
router.get("/billing/stats", async (_req, res) => {
  const [total, byTier] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(subscriptions),
    db
      .select({ tier: subscriptions.tier, count: sql<number>`count(*)` })
      .from(subscriptions)
      .groupBy(subscriptions.tier),
  ]);

  return res.json({ total: total[0]?.count ?? 0, byTier });
});

// ── Queues (BullMQ) ────────────────────────────────────────────────────────────

// GET /admin/queues — BullMQ queue health stats
router.get("/queues", async (_req, res) => {
  const queueDefs = [
    { name: "post-execution", queue: postExecutionQueue },
    { name: "plan-generation", queue: planGenerationQueue },
    { name: "content-generation", queue: contentGenerationQueue },
    { name: "analytics", queue: analyticsQueue },
    { name: "ingestor", queue: ingestorQueue },
    { name: "notifications", queue: notificationQueue },
  ];

  const stats = await Promise.all(
    queueDefs.map(async ({ name, queue }) => {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
      ]);
      return { name, waiting, active, completed, failed, delayed };
    }),
  );

  return res.json(stats);
});

// ── Agents (admin view) ────────────────────────────────────────────────────────

// GET /admin/agents — list all agents across all orgs
router.get("/agents", async (req, res) => {
  const { orgId } = req.query as { orgId?: string };

  const allAgents = orgId
    ? await db.query.agents.findMany({
        where: eq(agents.organizationId, orgId),
        orderBy: [desc(agents.createdAt)],
        limit: 100,
      })
    : await db.query.agents.findMany({
        orderBy: [desc(agents.createdAt)],
        limit: 200,
      });

  // Attach org names
  const orgIds = [...new Set(allAgents.map((a) => a.organizationId))];
  const orgs = orgIds.length > 0
    ? await db.query.organizations.findMany({
        where: (o, { inArray }) => inArray(o.id, orgIds),
      })
    : [];
  const orgMap = new Map(orgs.map((o) => [o.id, o.name]));

  return res.json(allAgents.map((a) => ({ ...a, organizationName: orgMap.get(a.organizationId) ?? null })));
});

// PUT /admin/agents/:id/silence
router.put("/agents/:id/silence", async (req, res) => {
  const { reason } = req.body as { reason?: string };
  await db
    .update(agents)
    .set({ isActive: false, silencedAt: new Date(), silenceReason: reason ?? "Silenced by admin", updatedAt: new Date() })
    .where(eq(agents.id, req.params.id!));
  return res.json({ silenced: true });
});

// PUT /admin/agents/:id/resume
router.put("/agents/:id/resume", async (req, res) => {
  await db
    .update(agents)
    .set({ isActive: true, silencedAt: null, silenceReason: null, updatedAt: new Date() })
    .where(eq(agents.id, req.params.id!));
  return res.json({ resumed: true });
});

// ── Plan Tier Pricing ──────────────────────────────────────────────────────────

// GET /admin/plans — list all plan tiers with current pricing
router.get("/plans", async (_req, res) => {
  const tiers = await db.query.planTiers.findMany({
    orderBy: (t, { asc }) => [asc(t.monthlyPrice)],
  });
  return res.json(tiers);
});

// PUT /admin/plans/:tier — update pricing for a plan tier (applies to new subscribers only)
router.put("/plans/:tier", async (req, res) => {
  const { monthlyPrice, annualPrice } = req.body as { monthlyPrice?: number; annualPrice?: number };

  if (monthlyPrice === undefined && annualPrice === undefined) {
    return res.status(400).json({ error: "Provide at least one of monthlyPrice or annualPrice" });
  }
  if (monthlyPrice !== undefined && (typeof monthlyPrice !== "number" || monthlyPrice < 0)) {
    return res.status(400).json({ error: "monthlyPrice must be a non-negative integer (cents)" });
  }
  if (annualPrice !== undefined && (typeof annualPrice !== "number" || annualPrice < 0)) {
    return res.status(400).json({ error: "annualPrice must be a non-negative integer (cents)" });
  }

  const [updated] = await db
    .update(planTiers)
    .set({
      ...(monthlyPrice !== undefined && { monthlyPrice }),
      ...(annualPrice !== undefined && { annualPrice }),
    })
    .where(eq(planTiers.tier, req.params.tier as never))
    .returning();

  if (!updated) return res.status(404).json({ error: `Plan tier '${req.params.tier}' not found` });

  return res.json(updated);
});

// ── Email Templates ────────────────────────────────────────────────────────────

// GET /admin/email-templates — list all templates
router.get("/email-templates", async (_req, res) => {
  const templates = await db.query.emailTemplates.findMany({
    orderBy: (t, { asc }) => [asc(t.id)],
  });
  return res.json(templates);
});

// GET /admin/email-templates/:id
router.get("/email-templates/:id", async (req, res) => {
  const template = await db.query.emailTemplates.findFirst({
    where: eq(emailTemplates.id, req.params.id!),
  });
  if (!template) return res.status(404).json({ error: "Template not found" });
  return res.json(template);
});

// PUT /admin/email-templates/:id — update subject and/or body
router.put("/email-templates/:id", async (req, res) => {
  const { subject, htmlBody, plainText } = req.body as {
    subject?: string;
    htmlBody?: string;
    plainText?: string;
  };

  if (!subject && !htmlBody && !plainText) {
    return res.status(400).json({ error: "Provide at least one of subject, htmlBody, or plainText" });
  }

  const existing = await db.query.emailTemplates.findFirst({
    where: eq(emailTemplates.id, req.params.id!),
  });
  if (!existing) return res.status(404).json({ error: "Template not found" });

  const [updated] = await db
    .update(emailTemplates)
    .set({
      ...(subject !== undefined && { subject }),
      ...(htmlBody !== undefined && { htmlBody }),
      ...(plainText !== undefined && { plainText }),
      updatedAt: new Date(),
    })
    .where(eq(emailTemplates.id, req.params.id!))
    .returning();

  return res.json(updated);
});

export { router as adminRouter };
