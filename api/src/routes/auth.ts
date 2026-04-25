import { Router } from "express";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { db } from "../db/client";
import { users, organizations, subscriptions } from "../db/schema";
import { issueToken } from "../middleware/auth";
import { redisConnection } from "../queue/client";
import { z } from "zod";
import { productConfig } from "@anthyx/config";

const RESET_TTL = 3600; // 1 hour

async function sendPasswordResetEmail(email: string, resetUrl: string) {
  const apiKey = process.env["RESEND_API_KEY"];
  const from = process.env["EMAIL_FROM"] ?? "noreply@anthyx.ai";

  if (!apiKey || apiKey.startsWith("re_...")) {
    console.log(`[AUTH] Password reset link for ${email}: ${resetUrl}`);
    return;
  }

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: email,
      subject: "Reset your Anthyx password",
      html: `<p>Click the link below to reset your password. It expires in 1 hour.</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
    }),
  });
}

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

const EMAIL_VERIFY_TTL = 86400; // 24 hours

async function sendVerificationEmail(email: string, verifyUrl: string) {
  const apiKey = process.env["RESEND_API_KEY"];
  const from = process.env["EMAIL_FROM"] ?? "noreply@anthyx.ai";

  if (!apiKey || apiKey.startsWith("re_...")) {
    console.log(`[AUTH] Verification link for ${email}: ${verifyUrl}`);
    return;
  }

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: email,
      subject: "Verify your Anthyx email",
      html: `<p>Welcome to Anthyx! Click the link below to verify your email address. This link expires in 24 hours.</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
    }),
  });
}

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

  // Send email verification
  const verifyToken = randomBytes(32).toString("hex");
  await redisConnection.set(`email_verify:${verifyToken}`, user.id, "EX", EMAIL_VERIFY_TTL);
  const dashboardUrl = process.env["DASHBOARD_URL"] ?? "http://localhost:3000";
  await sendVerificationEmail(email, `${dashboardUrl}/verify-email?token=${verifyToken}`);

  const token = issueToken({ id: user.id, email: user.email, orgId: org.id, role: user.role });

  res.cookie("auth_token", token, {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return res.status(201).json({ user: { id: user.id, email: user.email, name: user.name }, emailVerificationSent: true });
});

// GET /auth/verify-email?token=...
router.get("/verify-email", async (req, res) => {
  const { token } = req.query as { token?: string };
  const dashboardUrl = process.env["DASHBOARD_URL"] ?? "http://localhost:3000";

  if (!token) return res.redirect(`${dashboardUrl}/verify-email?error=missing_token`);

  const userId = await redisConnection.get(`email_verify:${token}`);
  if (!userId) return res.redirect(`${dashboardUrl}/verify-email?error=invalid_token`);

  await db.update(users).set({ emailVerified: true }).where(eq(users.id, userId));
  await redisConnection.del(`email_verify:${token}`);

  return res.redirect(`${dashboardUrl}/verify-email?success=1`);
});

// POST /auth/resend-verification — resend verification email for logged-in user
router.post("/resend-verification", async (req, res) => {
  const token = req.cookies?.["auth_token"] || req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const jwt = await import("jsonwebtoken");
    const payload = jwt.default.verify(token, process.env["JWT_SECRET"]!) as { sub: string };
    const user = await db.query.users.findFirst({ where: eq(users.id, payload.sub) });
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.emailVerified) return res.json({ ok: true, alreadyVerified: true });

    const verifyToken = randomBytes(32).toString("hex");
    await redisConnection.set(`email_verify:${verifyToken}`, user.id, "EX", EMAIL_VERIFY_TTL);
    const dashboardUrl = process.env["DASHBOARD_URL"] ?? "http://localhost:3000";
    await sendVerificationEmail(user.email, `${dashboardUrl}/verify-email?token=${verifyToken}`);

    return res.json({ ok: true });
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
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

  return res.json({ user: { id: user.id, email: user.email, name: user.name, isSuperAdmin: user.isSuperAdmin } });
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
    const user = await db.query.users.findFirst({ where: eq(users.id, payload.sub) });
    return res.json({
      id: payload.sub,
      email: payload.email,
      orgId: payload.orgId,
      role: payload.role,
      emailVerified: user?.emailVerified ?? false,
      isSuperAdmin: user?.isSuperAdmin ?? false,
    });
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
});

// POST /auth/forgot-password
router.post("/forgot-password", async (req, res) => {
  const parsed = z.object({ email: z.string().email() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Valid email required" });

  const { email } = parsed.data;
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });

  // Always respond OK so we don't leak whether an email exists
  if (user) {
    const token = randomBytes(32).toString("hex");
    await redisConnection.set(`pwd_reset:${token}`, user.id, "EX", RESET_TTL);
    const dashboardUrl = process.env["DASHBOARD_URL"] ?? "http://localhost:3000";
    await sendPasswordResetEmail(email, `${dashboardUrl}/reset-password?token=${token}`);
  }

  return res.json({ ok: true });
});

// POST /auth/reset-password
router.post("/reset-password", async (req, res) => {
  const parsed = z.object({
    token: z.string().min(1),
    newPassword: z.string().min(8),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Validation failed" });

  const { token, newPassword } = parsed.data;
  const userId = await redisConnection.get(`pwd_reset:${token}`);
  if (!userId) return res.status(400).json({ error: "Invalid or expired reset link" });

  const newHash = await bcrypt.hash(newPassword, 12);
  await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, userId));
  await redisConnection.del(`pwd_reset:${token}`);

  return res.json({ ok: true });
});

// ── Google OAuth ────────────────────────────────────────────────────────────────

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

// GET /auth/google — redirect to Google consent screen
router.get("/google", (req, res) => {
  const clientId = process.env["GOOGLE_CLIENT_ID"];
  const callbackUrl = process.env["GOOGLE_CALLBACK_URL"] ?? "http://localhost:4000/v1/auth/google/callback";
  const dashboardUrl = process.env["DASHBOARD_URL"] ?? "http://localhost:3000";

  if (!clientId) {
    return res.redirect(`${dashboardUrl}/login?error=google_not_configured`);
  }

  const state = randomBytes(16).toString("hex");
  // Store state in a short-lived cookie for CSRF protection
  res.cookie("oauth_state", state, { httpOnly: true, maxAge: 600_000, sameSite: "lax" });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    response_type: "code",
    scope: "openid email profile",
    state,
  });

  return res.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
});

// GET /auth/google/callback — exchange code for user info, create/login user
router.get("/google/callback", async (req, res) => {
  const dashboardUrl = process.env["DASHBOARD_URL"] ?? "http://localhost:3000";
  const clientId = process.env["GOOGLE_CLIENT_ID"];
  const clientSecret = process.env["GOOGLE_CLIENT_SECRET"];
  const callbackUrl = process.env["GOOGLE_CALLBACK_URL"] ?? "http://localhost:4000/v1/auth/google/callback";

  const { code, state, error: oauthError } = req.query as Record<string, string>;

  if (oauthError) return res.redirect(`${dashboardUrl}/login?error=oauth_denied`);

  const storedState = req.cookies?.["oauth_state"];
  if (!state || state !== storedState) return res.redirect(`${dashboardUrl}/login?error=oauth_state_mismatch`);
  res.clearCookie("oauth_state");

  if (!clientId || !clientSecret) return res.redirect(`${dashboardUrl}/login?error=google_not_configured`);

  try {
    // Exchange code for tokens
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) return res.redirect(`${dashboardUrl}/login?error=token_exchange_failed`);
    const { access_token } = await tokenRes.json() as { access_token: string };

    // Get user profile
    const profileRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!profileRes.ok) return res.redirect(`${dashboardUrl}/login?error=profile_fetch_failed`);
    const profile = await profileRes.json() as { sub: string; email: string; name: string };

    // Find or create user
    let user = await db.query.users.findFirst({ where: eq(users.email, profile.email) });

    if (!user) {
      // Auto-create org + user for new Google sign-ups
      const slug = profile.name.toLowerCase().replace(/[^a-z0-9]/g, "-") + "-" + Date.now();
      const [org] = await db.insert(organizations).values({ name: profile.name, slug }).returning();
      if (!org) return res.redirect(`${dashboardUrl}/login?error=org_creation_failed`);

      const now = new Date();
      await db.insert(subscriptions).values({
        organizationId: org.id,
        tier: "sandbox",
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      });

      [user] = await db.insert(users).values({
        organizationId: org.id,
        email: profile.email,
        name: profile.name,
        role: "owner",
        emailVerified: true,
      }).returning();
    }

    if (!user?.organizationId) return res.redirect(`${dashboardUrl}/login?error=no_org`);

    const token = issueToken({ id: user.id, email: user.email, orgId: user.organizationId, role: user.role });
    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.redirect(`${dashboardUrl}/dashboard`);
  } catch (err) {
    console.error("[AUTH] Google OAuth error:", err);
    return res.redirect(`${dashboardUrl}/login?error=oauth_failed`);
  }
});

export { router as authRouter };
