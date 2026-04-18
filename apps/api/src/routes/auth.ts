import { Router } from "express";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "../db/client";
import { users, organizations, subscriptions } from "../db/schema";
import { issueToken } from "../middleware/auth";
import { z } from "zod";
import { productConfig } from "@anthyx/config";

const router = Router();

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  organizationName: z.string().min(1),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /auth/register
router.post("/register", async (req, res) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Validation failed" });

  const { email, password, name, organizationName } = parsed.data;

  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) return res.status(409).json({ error: "Email already registered" });

  const passwordHash = await bcrypt.hash(password, 12);
  const slug = organizationName.toLowerCase().replace(/[^a-z0-9]/g, "-") + "-" + Date.now();

  // Create org
  const [org] = await db.insert(organizations).values({ name: organizationName, slug }).returning();
  if (!org) return res.status(500).json({ error: "Failed to create organization" });

  // Create user
  const [user] = await db.insert(users).values({
    organizationId: org.id,
    email,
    name,
    passwordHash,
    role: "owner",
  }).returning();
  if (!user) return res.status(500).json({ error: "Failed to create user" });

  // Create sandbox subscription
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  await db.insert(subscriptions).values({
    organizationId: org.id,
    tier: "sandbox",
    status: "active",
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
  });

  const token = issueToken({ id: user.id, email: user.email, orgId: org.id, role: user.role });

  res.cookie("auth_token", token, {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return res.status(201).json({ user: { id: user.id, email: user.email, name: user.name } });
});

// POST /auth/login
router.post("/login", async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Validation failed" });

  const { email, password } = parsed.data;

  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user?.passwordHash) return res.status(401).json({ error: "Invalid credentials" });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });
  if (!user.organizationId) return res.status(401).json({ error: "No organization" });

  const token = issueToken({
    id: user.id,
    email: user.email,
    orgId: user.organizationId,
    role: user.role,
  });

  res.cookie("auth_token", token, {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return res.json({ user: { id: user.id, email: user.email, name: user.name } });
});

// POST /auth/logout
router.post("/logout", (req, res) => {
  res.clearCookie("auth_token");
  return res.json({ ok: true });
});

// PUT /auth/me — update display name
router.put("/me", async (req, res) => {
  const token =
    req.cookies?.["auth_token"] || req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const jwt = await import("jsonwebtoken");
    const payload = jwt.default.verify(token, process.env["JWT_SECRET"]!) as { sub: string };
    const parsed = z.object({ name: z.string().min(1).max(100) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed" });

    const [updated] = await db
      .update(users)
      .set({ name: parsed.data.name })
      .where(eq(users.id, payload.sub))
      .returning();

    return res.json({ id: updated!.id, email: updated!.email, name: updated!.name });
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
});

// PUT /auth/password — change password
router.put("/password", async (req, res) => {
  const token =
    req.cookies?.["auth_token"] || req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const jwt = await import("jsonwebtoken");
    const payload = jwt.default.verify(token, process.env["JWT_SECRET"]!) as { sub: string };

    const parsed = z
      .object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(8),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed" });

    const user = await db.query.users.findFirst({ where: eq(users.id, payload.sub) });
    if (!user?.passwordHash) return res.status(404).json({ error: "User not found" });

    const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
    if (!valid) return res.status(400).json({ error: "Current password is incorrect" });

    const newHash = await bcrypt.hash(parsed.data.newPassword, 12);
    await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, user.id));

    return res.json({ ok: true });
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
});

// GET /auth/me
router.get("/me", async (req, res) => {
  const token =
    req.cookies?.["auth_token"] || req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const jwt = await import("jsonwebtoken");
    const payload = jwt.default.verify(token, process.env["JWT_SECRET"]!) as {
      sub: string;
      email: string;
      orgId: string;
      role: string;
    };
    return res.json({ id: payload.sub, email: payload.email, orgId: payload.orgId, role: payload.role });
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
});

export { router as authRouter };
