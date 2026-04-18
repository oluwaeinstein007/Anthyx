import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../db/client";
import { socialAccounts, organizations } from "../db/schema";
import { auth } from "../middleware/auth";
import { encryptToken } from "../services/oauth-proxy/crypto";
import { PlanLimitsEnforcer } from "../services/billing/limits";
import type { Platform } from "@anthyx/types";
import { randomBytes, createHash } from "crypto";
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

  const missingEnv = (vars: string[]) => {
    const missing = vars.filter((v) => !process.env[v]);
    if (missing.length) return `Missing env vars: ${missing.join(", ")}`;
    return null;
  };

  switch (platform) {
    case "x": {
      const envError = missingEnv(["TWITTER_CLIENT_ID", "TWITTER_CALLBACK_URL"]);
      if (envError) return res.status(500).json({ error: envError });
      const codeVerifier = randomBytes(32).toString("base64url");
      const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
      await redisConnection.set(
        `oauth:pkce:${state}`,
        codeVerifier,
        "EX",
        OAUTH_STATE_TTL,
      );
      authUrl =
        `https://twitter.com/i/oauth2/authorize?` +
        new URLSearchParams({
          response_type: "code",
          client_id: process.env["TWITTER_CLIENT_ID"]!,
          redirect_uri: process.env["TWITTER_CALLBACK_URL"]!,
          scope: "tweet.read tweet.write users.read offline.access",
          state,
          code_challenge: codeChallenge,
          code_challenge_method: "S256",
        }).toString();
      break;
    }
    case "linkedin": {
      const envError = missingEnv(["LINKEDIN_CLIENT_ID", "LINKEDIN_CALLBACK_URL"]);
      if (envError) return res.status(500).json({ error: envError });
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
    }
    case "instagram": {
      const envError = missingEnv(["INSTAGRAM_APP_ID", "INSTAGRAM_CALLBACK_URL"]);
      if (envError) return res.status(500).json({ error: envError });
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
    }
    case "facebook": {
      const envError = missingEnv(["FACEBOOK_APP_ID", "FACEBOOK_CALLBACK_URL"]);
      if (envError) return res.status(500).json({ error: envError });
      authUrl =
        `https://www.facebook.com/v18.0/dialog/oauth?` +
        new URLSearchParams({
          client_id: process.env["FACEBOOK_APP_ID"]!,
          redirect_uri: process.env["FACEBOOK_CALLBACK_URL"]!,
          scope: "pages_manage_posts,pages_read_engagement,instagram_basic,instagram_content_publish",
          response_type: "code",
          state,
        }).toString();
      break;
    }
    case "tiktok": {
      const envError = missingEnv(["TIKTOK_CLIENT_ID", "TIKTOK_CALLBACK_URL"]);
      if (envError) return res.status(500).json({ error: envError });
      const codeVerifier = randomBytes(32).toString("base64url");
      const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
      await redisConnection.set(
        `oauth:pkce:${state}`,
        codeVerifier,
        "EX",
        OAUTH_STATE_TTL,
      );
      authUrl =
        `https://www.tiktok.com/v2/auth/authorize/?` +
        new URLSearchParams({
          client_key: process.env["TIKTOK_CLIENT_ID"]!,
          redirect_uri: process.env["TIKTOK_CALLBACK_URL"]!,
          scope: "user.info.basic,video.publish,video.upload",
          response_type: "code",
          state,
          code_challenge: codeChallenge,
          code_challenge_method: "S256",
        }).toString();
      break;
    }
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

  const codeVerifier = await redisConnection.get(`oauth:pkce:${state}`);
  if (codeVerifier) await redisConnection.del(`oauth:pkce:${state}`);

  switch (platform) {
    case "x":
      if (!codeVerifier) return res.status(400).json({ error: "Missing PKCE verifier" });
      tokens = await exchangeTwitterCode(code, codeVerifier);
      break;
    case "linkedin":
      tokens = await exchangeLinkedInCode(code);
      break;
    case "instagram":
      tokens = await exchangeInstagramCode(code);
      break;
    case "facebook":
      tokens = await exchangeFacebookCode(code);
      break;
    case "tiktok":
      if (!codeVerifier) return res.status(400).json({ error: "Missing PKCE verifier" });
      tokens = await exchangeTikTokCode(code, codeVerifier);
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

async function exchangeTwitterCode(code: string, codeVerifier: string) {
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
      code_verifier: codeVerifier,
    }),
  });
  const data = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };

  // Fetch the user's handle
  const userRes = await fetch("https://api.twitter.com/2/users/me", {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });
  const userData = (await userRes.json()) as { data?: { username: string } };
  const handle = userData.data?.username ?? "twitter_user";

  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresIn: data.expires_in, handle };
}

async function exchangeFacebookCode(code: string) {
  const res = await fetch(
    `https://graph.facebook.com/v18.0/oauth/access_token?` +
    new URLSearchParams({
      client_id: process.env["FACEBOOK_APP_ID"]!,
      client_secret: process.env["FACEBOOK_APP_SECRET"]!,
      redirect_uri: process.env["FACEBOOK_CALLBACK_URL"]!,
      code,
    }),
  );
  const data = (await res.json()) as { access_token: string; expires_in?: number };

  const meRes = await fetch(`https://graph.facebook.com/me?fields=name&access_token=${data.access_token}`);
  const me = (await meRes.json()) as { id: string; name?: string };

  return { accessToken: data.access_token, expiresIn: data.expires_in, accountId: me.id, handle: me.name ?? "facebook_user" };
}

async function exchangeTikTokCode(code: string, codeVerifier: string) {
  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: process.env["TIKTOK_CLIENT_ID"]!,
      client_secret: process.env["TIKTOK_CLIENT_SECRET"]!,
      code,
      grant_type: "authorization_code",
      redirect_uri: process.env["TIKTOK_CALLBACK_URL"]!,
      code_verifier: codeVerifier,
    }),
  });
  const data = (await res.json()) as { data?: { access_token: string; refresh_token?: string; expires_in: number; open_id: string } };
  const t = data.data!;
  return { accessToken: t.access_token, refreshToken: t.refresh_token, expiresIn: t.expires_in, accountId: t.open_id, handle: "tiktok_user" };
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

  const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });
  const profile = (await profileRes.json()) as { sub?: string; name?: string };
  const handle = profile.name ?? "linkedin_user";

  return { accessToken: data.access_token, expiresIn: data.expires_in, accountId: profile.sub, handle };
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
