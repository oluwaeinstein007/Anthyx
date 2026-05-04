import { Router } from "express";
import { eq, and, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { generateSecret as totpGenerateSecret, verify as totpVerify } from "otplib";
import { db } from "../db/client";
import { users, organizations, subscriptions, adminInvites } from "../db/schema";
import { issueToken, auth } from "../middleware/auth";
import { redisConnection } from "../queue/client";
import { z } from "zod";
import { productConfig } from "@anthyx/config";

const ANTHYX_INTERNAL_ORG_ID = "00000000-0000-0000-0000-000000000001";

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

  // If TOTP is enabled, issue a short-lived pending token instead of the full JWT
  if (user.totpEnabled) {
    const pendingToken = randomBytes(32).toString("hex");
    await redisConnection.set(`totp_pending:${pendingToken}`, user.id, "EX", 300); // 5 min
    return res.json({ requiresTotp: true, pendingToken });
  }

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

  return res.json({ user: { id: user.id, email: user.email, name: user.name, isSuperAdmin: user.isSuperAdmin, mustChangePassword: user.mustChangePassword ?? false } });
});

// POST /auth/logout
router.post("/logout", (req, res) => {
  res.clearCookie("auth_token");
  return res.json({ ok: true });
});

// POST /auth/admin/login — issues an admin-scoped token (aud: 'admin') via admin_token cookie
router.post("/admin/login", async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Validation failed" });

  const { email, password } = parsed.data;

  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user?.passwordHash) return res.status(401).json({ error: "Invalid credentials" });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });
  if (!user.isSuperAdmin) return res.status(403).json({ error: "Access denied — admin only" });
  if (!user.organizationId) return res.status(401).json({ error: "No organization" });

  const token = issueToken({
    id: user.id,
    email: user.email,
    orgId: user.organizationId,
    role: user.role,
  }, "admin");

  res.cookie("admin_token", token, {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return res.json({ user: { id: user.id, email: user.email, name: user.name, isSuperAdmin: true, mustChangePassword: user.mustChangePassword ?? false } });
});

// POST /auth/admin/logout
router.post("/admin/logout", (req, res) => {
  res.clearCookie("admin_token");
  return res.json({ ok: true });
});

// GET /auth/admin/me — reads admin_token cookie
router.get("/admin/me", async (req, res) => {
  const token =
    req.cookies?.["admin_token"] || req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const jwtLib = await import("jsonwebtoken");
    const secret = process.env["JWT_SECRET"]!;
    const payload = jwtLib.default.verify(token, secret) as { sub: string; aud?: string };

    if (payload.aud !== "admin") return res.status(401).json({ error: "Unauthorized" });

    const user = await db.query.users.findFirst({ where: eq(users.id, payload.sub) });
    if (!user?.isSuperAdmin) return res.status(403).json({ error: "Forbidden" });

    return res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      isSuperAdmin: user.isSuperAdmin,
      mustChangePassword: user.mustChangePassword ?? false,
    });
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
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
        code: code ?? "",
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

// GET /auth/admin/invite — verify token is valid and return invite details (pre-flight)
router.get("/admin/invite", async (req, res) => {
  const { token } = req.query as { token?: string };
  if (!token) return res.status(400).json({ error: "token is required" });

  const invite = await db.query.adminInvites.findFirst({
    where: and(eq(adminInvites.token, token), isNull(adminInvites.revokedAt)),
  });

  if (!invite) return res.status(404).json({ error: "Invite not found or revoked" });
  if (invite.acceptedAt) return res.status(409).json({ error: "Invite already accepted" });
  if (new Date() > invite.expiresAt) return res.status(410).json({ error: "Invite has expired" });

  return res.json({ email: invite.email, role: invite.role, expiresAt: invite.expiresAt });
});

// POST /auth/admin/accept-invite — set password + create admin user from invite token
router.post("/admin/accept-invite", async (req, res) => {
  const { token, name, password } = req.body as { token?: string; name?: string; password?: string };

  if (!token || !name || !password) {
    return res.status(400).json({ error: "token, name, and password are required" });
  }
  if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

  const invite = await db.query.adminInvites.findFirst({
    where: and(eq(adminInvites.token, token), isNull(adminInvites.revokedAt)),
  });

  if (!invite) return res.status(404).json({ error: "Invite not found or revoked" });
  if (invite.acceptedAt) return res.status(409).json({ error: "Invite already accepted" });
  if (new Date() > invite.expiresAt) return res.status(410).json({ error: "Invite has expired" });

  // Check user doesn't already exist
  const existing = await db.query.users.findFirst({ where: eq(users.email, invite.email) });
  if (existing) return res.status(409).json({ error: "Account already exists for this email" });

  const passwordHash = await bcrypt.hash(password, 10);

  const [newUser] = await db
    .insert(users)
    .values({
      organizationId: ANTHYX_INTERNAL_ORG_ID,
      email: invite.email,
      name,
      passwordHash,
      role: invite.role,
      isSuperAdmin: true,
      emailVerified: true,
      mustChangePassword: false,
    })
    .returning();

  // Mark invite as accepted
  await db
    .update(adminInvites)
    .set({ acceptedAt: new Date() })
    .where(eq(adminInvites.id, invite.id));

  if (!newUser) return res.status(500).json({ error: "Failed to create user" });

  // Issue admin token
  const adminToken = issueToken(
    { id: newUser.id, email: newUser.email, orgId: ANTHYX_INTERNAL_ORG_ID, role: newUser.role },
    "admin",
  );

  res.cookie("admin_token", adminToken, {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return res.json({ user: { id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role } });
});

// ── TOTP 2FA ────────────────────────────────────────────────────────────────────

// POST /auth/totp/setup — generate secret + otpauth URL for QR code (step 1)
router.post("/totp/setup", auth, async (req, res) => {
  const secret = totpGenerateSecret();
  await redisConnection.set(`totp_setup:${req.user.id}`, secret, "EX", 600);
  const productName = process.env["PRODUCT_NAME"] ?? "Anthyx";
  const otpauthUrl = `otpauth://totp/${encodeURIComponent(productName)}:${encodeURIComponent(req.user.email)}?secret=${secret}&issuer=${encodeURIComponent(productName)}&algorithm=SHA1&digits=6&period=30`;
  return res.json({ secret, otpauthUrl });
});

// POST /auth/totp/enable — verify first token from authenticator app (step 2)
router.post("/totp/enable", auth, async (req, res) => {
  const { token } = req.body as { token?: string };
  if (!token) return res.status(400).json({ error: "token is required" });

  const secret = await redisConnection.get(`totp_setup:${req.user.id}`);
  if (!secret) return res.status(400).json({ error: "No TOTP setup in progress — call POST /auth/totp/setup first" });

  const result = await totpVerify({ token, secret });
  if (!result?.valid) return res.status(400).json({ error: "Invalid TOTP token" });

  await db.update(users).set({ totpSecret: secret, totpEnabled: true }).where(eq(users.id, req.user.id));
  await redisConnection.del(`totp_setup:${req.user.id}`);
  return res.json({ enabled: true });
});

// POST /auth/totp/disable — disable TOTP (must supply current valid token)
router.post("/totp/disable", auth, async (req, res) => {
  const { token } = req.body as { token?: string };
  if (!token) return res.status(400).json({ error: "token is required" });

  const user = await db.query.users.findFirst({ where: eq(users.id, req.user.id) });
  if (!user?.totpEnabled || !user.totpSecret) return res.status(400).json({ error: "2FA is not enabled" });

  const result = await totpVerify({ token, secret: user.totpSecret });
  if (!result?.valid) return res.status(400).json({ error: "Invalid TOTP token" });

  await db.update(users).set({ totpEnabled: false, totpSecret: null }).where(eq(users.id, req.user.id));
  return res.json({ disabled: true });
});

// POST /auth/totp/verify — complete login when TOTP is required
router.post("/totp/verify", async (req, res) => {
  const { pendingToken, token } = req.body as { pendingToken?: string; token?: string };
  if (!pendingToken || !token) return res.status(400).json({ error: "pendingToken and token are required" });

  const userId = await redisConnection.get(`totp_pending:${pendingToken}`);
  if (!userId) return res.status(401).json({ error: "Invalid or expired pending token" });

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user?.totpSecret || !user.organizationId) return res.status(401).json({ error: "Invalid session" });

  const result = await totpVerify({ token, secret: user.totpSecret });
  if (!result?.valid) return res.status(401).json({ error: "Invalid TOTP token" });

  await redisConnection.del(`totp_pending:${pendingToken}`);

  const jwtToken = issueToken({ id: user.id, email: user.email, orgId: user.organizationId, role: user.role });
  res.cookie("auth_token", jwtToken, {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return res.json({ user: { id: user.id, email: user.email, name: user.name } });
});

export { router as authRouter };
