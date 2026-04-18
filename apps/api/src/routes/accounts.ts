import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../db/client";
import { socialAccounts, organizations } from "../db/schema";
import { auth } from "../middleware/auth";
import { encryptToken } from "../services/oauth-proxy/crypto";
import { PlanLimitsEnforcer } from "../services/billing/limits";
import type { Platform } from "@anthyx/types";
import { randomBytes } from "crypto";
import { redisConnection } from "../queue/client";

const router = Router();

const OAUTH_STATE_TTL = 10 * 60; // 10 minutes

// GET /accounts/oauth/:platform — generate OAuth URL
router.get("/oauth/:platform", auth, async (req, res) => {
  const platform = req.params.platform as Platform;
  const state = randomBytes(16).toString("hex");

  // Store state in Redis with TTL
  await redisConnection.set(
    `oauth:state:${state}`,
    JSON.stringify({ orgId: req.user.orgId, userId: req.user.id, platform }),
    "EX",
    OAUTH_STATE_TTL,
  );

  let authUrl: string;

  switch (platform) {
    case "x":
      authUrl =
        `https://twitter.com/i/oauth2/authorize?` +
        new URLSearchParams({
          response_type: "code",
          client_id: process.env["TWITTER_CLIENT_ID"]!,
          redirect_uri: process.env["TWITTER_CALLBACK_URL"]!,
          scope: "tweet.read tweet.write users.read offline.access",
          state,
          code_challenge: "challenge",
          code_challenge_method: "plain",
        }).toString();
      break;
    case "linkedin":
      authUrl =
        `https://www.linkedin.com/oauth/v2/authorization?` +
        new URLSearchParams({
          response_type: "code",
          client_id: process.env["LINKEDIN_CLIENT_ID"]!,
          redirect_uri: process.env["LINKEDIN_CALLBACK_URL"]!,
          scope: "w_member_social r_basicprofile",
          state,
        }).toString();
      break;
    case "instagram":
      authUrl =
        `https://api.instagram.com/oauth/authorize?` +
        new URLSearchParams({
          client_id: process.env["INSTAGRAM_APP_ID"]!,
          redirect_uri: process.env["INSTAGRAM_CALLBACK_URL"]!,
          scope: "instagram_basic,instagram_content_publish",
          response_type: "code",
          state,
        }).toString();
      break;
    default:
      return res.status(400).json({ error: `OAuth not supported for platform: ${platform}` });
  }

  return res.json({ authUrl });
});

// GET /accounts/oauth/callback
router.get("/oauth/callback", async (req, res) => {
  const { code, state, error } = req.query as Record<string, string>;

  if (error) return res.redirect(`${process.env["DASHBOARD_URL"]}/accounts?error=${error}`);
  if (!code || !state) return res.status(400).json({ error: "Missing code or state" });

  const stateData = await redisConnection.get(`oauth:state:${state}`);
  if (!stateData) return res.status(400).json({ error: "Invalid or expired state" });

  await redisConnection.del(`oauth:state:${state}`);
  const { orgId, userId, platform } = JSON.parse(stateData) as {
    orgId: string;
    userId: string;
    platform: Platform;
  };

  await PlanLimitsEnforcer.check(orgId, "account");

  // Exchange code for tokens
  let tokens: { accessToken: string; refreshToken?: string; expiresIn?: number; accountId?: string; handle?: string };

  switch (platform) {
    case "x":
      tokens = await exchangeTwitterCode(code);
      break;
    case "linkedin":
      tokens = await exchangeLinkedInCode(code);
      break;
    case "instagram":
      tokens = await exchangeInstagramCode(code);
      break;
    default:
      return res.status(400).json({ error: "Unsupported platform" });
  }

  const [account] = await db
    .insert(socialAccounts)
    .values({
      organizationId: orgId,
      platform,
      accountHandle: tokens.handle ?? platform,
      accountId: tokens.accountId,
      accessToken: encryptToken(tokens.accessToken),
      refreshToken: tokens.refreshToken ? encryptToken(tokens.refreshToken) : null,
      tokenExpiresAt: tokens.expiresIn
        ? new Date(Date.now() + tokens.expiresIn * 1000)
        : null,
      isActive: true,
    })
    .onConflictDoUpdate({
      target: [socialAccounts.organizationId, socialAccounts.platform, socialAccounts.accountHandle] as [typeof socialAccounts.organizationId, typeof socialAccounts.platform, typeof socialAccounts.accountHandle],
      set: {
        accessToken: encryptToken(tokens.accessToken),
        refreshToken: tokens.refreshToken ? encryptToken(tokens.refreshToken) : undefined,
        tokenExpiresAt: tokens.expiresIn
          ? new Date(Date.now() + tokens.expiresIn * 1000)
          : undefined,
        updatedAt: new Date(),
      },
    })
    .returning();

  return res.redirect(`${process.env["DASHBOARD_URL"]}/accounts?connected=${platform}`);
});

// GET /accounts
router.get("/", auth, async (req, res) => {
  const list = await db.query.socialAccounts.findMany({
    where: eq(socialAccounts.organizationId, req.user.orgId),
  });
  // Never return raw tokens
  return res.json(
    list.map(({ accessToken, refreshToken, ...rest }) => rest),
  );
});

// DELETE /accounts/:id
router.delete("/:id", auth, async (req, res) => {
  await db
    .delete(socialAccounts)
    .where(
      and(
        eq(socialAccounts.id, req.params.id!),
        eq(socialAccounts.organizationId, req.user.orgId),
      ),
    );
  return res.json({ ok: true });
});

async function exchangeTwitterCode(code: string) {
  const res = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env["TWITTER_CLIENT_ID"]}:${process.env["TWITTER_CLIENT_SECRET"]}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      redirect_uri: process.env["TWITTER_CALLBACK_URL"]!,
      code_verifier: "challenge",
    }),
  });
  const data = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresIn: data.expires_in, handle: "twitter_user" };
}

async function exchangeLinkedInCode(code: string) {
  const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env["LINKEDIN_CALLBACK_URL"]!,
      client_id: process.env["LINKEDIN_CLIENT_ID"]!,
      client_secret: process.env["LINKEDIN_CLIENT_SECRET"]!,
    }),
  });
  const data = (await res.json()) as { access_token: string; expires_in: number; refresh_token?: string };
  return { accessToken: data.access_token, expiresIn: data.expires_in, handle: "linkedin_user" };
}

async function exchangeInstagramCode(code: string) {
  const formData = new URLSearchParams({
    client_id: process.env["INSTAGRAM_APP_ID"]!,
    client_secret: process.env["INSTAGRAM_APP_SECRET"]!,
    grant_type: "authorization_code",
    redirect_uri: process.env["INSTAGRAM_CALLBACK_URL"]!,
    code,
  });
  const res = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    body: formData,
  });
  const data = (await res.json()) as { access_token: string; user_id: number };
  return { accessToken: data.access_token, accountId: String(data.user_id), handle: "ig_user" };
}

export { router as accountsRouter };
