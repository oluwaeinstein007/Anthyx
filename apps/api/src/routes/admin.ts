import { Router } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db } from "../db/client";
import {
  organizations,
  users,
  subscriptions,
  scheduledPosts,
  promoCodes,
  featureFlags,
  affiliates,
} from "../db/schema";
import { auth, issueToken } from "../middleware/auth";

const router = Router();

// All admin routes require authentication + super_admin flag
async function requireSuperAdmin(
  req: Parameters<Parameters<Router["use"]>[0]>[0] & { user: { id: string } },
  res: Parameters<Parameters<Router["use"]>[0]>[1],
  next: Parameters<Parameters<Router["use"]>[0]>[2],
) {
  const user = await db.query.users.findFirst({ where: eq(users.id, req.user.id) });
  if (!user?.isSuperAdmin) return res.status(403).json({ error: "Forbidden" });
  next();
}

router.use(auth, requireSuperAdmin as never);

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

export { router as adminRouter };
