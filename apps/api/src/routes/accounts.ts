import { Router } from "express";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "../db/client";
import { socialAccounts, organizations, scheduledPosts } from "../db/schema";
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
    case "reddit": {
      const envError = missingEnv(["REDDIT_CLIENT_ID", "REDDIT_CALLBACK_URL"]);
      if (envError) return res.status(500).json({ error: envError });
      authUrl =
        `https://www.reddit.com/api/v1/authorize?` +
        new URLSearchParams({
          client_id: process.env["REDDIT_CLIENT_ID"]!,
          response_type: "code",
          state,
          redirect_uri: process.env["REDDIT_CALLBACK_URL"]!,
          duration: "permanent",
          scope: "submit,identity,read",
        }).toString();
      break;
    }
    case "threads": {
      const envError = missingEnv(["THREADS_APP_ID", "THREADS_CALLBACK_URL"]);
      if (envError) return res.status(500).json({ error: envError });
      authUrl =
        `https://threads.net/oauth/authorize?` +
        new URLSearchParams({
          client_id: process.env["THREADS_APP_ID"]!,
          redirect_uri: process.env["THREADS_CALLBACK_URL"]!,
          scope: "threads_basic,threads_content_publish",
          response_type: "code",
          state,
        }).toString();
      break;
    }
    case "youtube": {
      const envError = missingEnv(["GOOGLE_CLIENT_ID", "GOOGLE_CALLBACK_URL"]);
      if (envError) return res.status(500).json({ error: envError });
      authUrl =
        `https://accounts.google.com/o/oauth2/v2/auth?` +
        new URLSearchParams({
          client_id: process.env["GOOGLE_CLIENT_ID"]!,
          redirect_uri: process.env["GOOGLE_CALLBACK_URL"]!,
          scope: "https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/youtube.force-ssl",
          response_type: "code",
          access_type: "offline",
          prompt: "consent",
          state,
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
    case "reddit":
      tokens = await exchangeRedditCode(code);
      break;
    case "threads":
      tokens = await exchangeThreadsCode(code);
      break;
    case "youtube":
      tokens = await exchangeYouTubeCode(code);
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

  await backfillPlanPosts(orgId, account!.id, platform);

  return res.redirect(`${process.env["DASHBOARD_URL"]}/accounts?connected=${platform}`);
});

// POST /accounts/telegram — connect via bot token (no OAuth)
router.post("/telegram", auth, async (req, res) => {
  try {
    const { botToken, chatId } = req.body as { botToken?: string; chatId?: string };

    if (!botToken?.trim() || !chatId?.trim()) {
      return res.status(400).json({ error: "Bot token and chat ID are required" });
    }

    const token = botToken.trim();
    const chat = chatId.trim();

    // Validate bot token
    const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const meData = (await meRes.json()) as { ok: boolean; result?: { id: number; username: string; first_name: string } };
    if (!meData.ok) {
      return res.status(400).json({ error: "Invalid bot token. Double-check what @BotFather gave you." });
    }
    const bot = meData.result!;

    // Validate bot has access to the specified chat
    const chatRes = await fetch(
      `https://api.telegram.org/bot${token}/getChat?chat_id=${encodeURIComponent(chat)}`,
    );
    const chatData = (await chatRes.json()) as {
      ok: boolean;
      result?: { id: number; title?: string; username?: string; type: string };
    };
    if (!chatData.ok) {
      return res
        .status(400)
        .json({ error: "Bot can't access that chat. Make sure it's been added as an admin." });
    }
    const chatInfo = chatData.result!;

    // Verify bot is actually an admin (for channels/groups)
    if (chatInfo.type !== "private") {
      const memberRes = await fetch(
        `https://api.telegram.org/bot${token}/getChatMember?chat_id=${encodeURIComponent(chat)}&user_id=${bot.id}`,
      );
      const memberData = (await memberRes.json()) as { ok: boolean; result?: { status: string } };
      const status = memberData.result?.status;
      if (!memberData.ok || !["administrator", "creator"].includes(status ?? "")) {
        return res
          .status(400)
          .json({ error: "Bot must be an admin of the channel or group to post." });
      }
    }

    await PlanLimitsEnforcer.check(req.user.orgId, "account");

    const handle = chatInfo.title ?? chatInfo.username ?? `chat_${chatInfo.id}`;
    const resolvedChatId = String(chatInfo.id);

    const [account] = await db
      .insert(socialAccounts)
      .values({
        organizationId: req.user.orgId,
        platform: "telegram",
        accountHandle: handle,
        accountId: resolvedChatId,
        accessToken: encryptToken(token),
        platformConfig: {
          chatId: resolvedChatId,
          chatTitle: handle,
          chatType: chatInfo.type,
          botUsername: bot.username,
        },
        isActive: true,
      })
      .onConflictDoUpdate({
        target: [socialAccounts.organizationId, socialAccounts.platform, socialAccounts.accountHandle] as [
          typeof socialAccounts.organizationId,
          typeof socialAccounts.platform,
          typeof socialAccounts.accountHandle,
        ],
        set: {
          accessToken: encryptToken(token),
          platformConfig: {
            chatId: resolvedChatId,
            chatTitle: handle,
            chatType: chatInfo.type,
            botUsername: bot.username,
          },
          updatedAt: new Date(),
        },
      })
      .returning();

    await backfillPlanPosts(req.user.orgId, account!.id, "telegram");

    return res.json({
      id: account!.id,
      platform: "telegram",
      accountHandle: handle,
      isActive: true,
    });
  } catch (err) {
    console.error("[accounts] telegram connect error:", err);
    return res.status(500).json({ error: "Failed to connect Telegram bot. Check your token and try again." });
  }
});

// POST /accounts/discord — connect via bot token + channel ID
router.post("/discord", auth, async (req, res) => {
  const { botToken, channelId } = req.body as { botToken?: string; channelId?: string };
  if (!botToken?.trim() || !channelId?.trim()) {
    return res.status(400).json({ error: "Bot token and channel ID are required" });
  }

  // Validate bot token by fetching the bot's own user
  const meRes = await fetch("https://discord.com/api/v10/users/@me", {
    headers: { Authorization: `Bot ${botToken.trim()}` },
  });
  if (!meRes.ok) return res.status(400).json({ error: "Invalid Discord bot token" });
  const me = (await meRes.json()) as { id: string; username: string };

  // Validate bot has access to the channel
  const chRes = await fetch(`https://discord.com/api/v10/channels/${channelId.trim()}`, {
    headers: { Authorization: `Bot ${botToken.trim()}` },
  });
  if (!chRes.ok) return res.status(400).json({ error: "Bot cannot access that channel — make sure it has been added to the server with Send Messages permission" });
  const ch = (await chRes.json()) as { id: string; name?: string; guild_id?: string };

  await PlanLimitsEnforcer.check(req.user.orgId, "account");

  const handle = ch.name ?? `channel_${ch.id}`;
  const [account] = await db
    .insert(socialAccounts)
    .values({
      organizationId: req.user.orgId,
      platform: "discord",
      accountHandle: handle,
      accountId: ch.id,
      accessToken: encryptToken(botToken.trim()),
      platformConfig: { channelId: ch.id, channelName: ch.name, botUsername: me.username },
      isActive: true,
    })
    .onConflictDoUpdate({
      target: [socialAccounts.organizationId, socialAccounts.platform, socialAccounts.accountHandle] as [typeof socialAccounts.organizationId, typeof socialAccounts.platform, typeof socialAccounts.accountHandle],
      set: { accessToken: encryptToken(botToken.trim()), updatedAt: new Date() },
    })
    .returning();

  await backfillPlanPosts(req.user.orgId, account!.id, "discord");
  return res.json({ id: account!.id, platform: "discord", accountHandle: handle, isActive: true });
});

// POST /accounts/slack — connect via bot OAuth token + channel ID
router.post("/slack", auth, async (req, res) => {
  const { botToken, channelId } = req.body as { botToken?: string; channelId?: string };
  if (!botToken?.trim() || !channelId?.trim()) {
    return res.status(400).json({ error: "Bot token and channel ID are required" });
  }

  const authRes = await fetch("https://slack.com/api/auth.test", {
    headers: { Authorization: `Bearer ${botToken.trim()}` },
  });
  const authData = (await authRes.json()) as { ok: boolean; user?: string; team?: string; error?: string };
  if (!authData.ok) return res.status(400).json({ error: `Invalid Slack token: ${authData.error}` });

  await PlanLimitsEnforcer.check(req.user.orgId, "account");

  const handle = `${authData.team ?? "workspace"}#${channelId.trim()}`;
  const [account] = await db
    .insert(socialAccounts)
    .values({
      organizationId: req.user.orgId,
      platform: "slack",
      accountHandle: handle,
      accountId: channelId.trim(),
      accessToken: encryptToken(botToken.trim()),
      platformConfig: { channelId: channelId.trim(), workspace: authData.team, botUser: authData.user },
      isActive: true,
    })
    .onConflictDoUpdate({
      target: [socialAccounts.organizationId, socialAccounts.platform, socialAccounts.accountHandle] as [typeof socialAccounts.organizationId, typeof socialAccounts.platform, typeof socialAccounts.accountHandle],
      set: { accessToken: encryptToken(botToken.trim()), updatedAt: new Date() },
    })
    .returning();

  await backfillPlanPosts(req.user.orgId, account!.id, "slack");
  return res.json({ id: account!.id, platform: "slack", accountHandle: handle, isActive: true });
});

// POST /accounts/whatsapp — connect via WhatsApp Business Cloud API token + phone number ID
router.post("/whatsapp", auth, async (req, res) => {
  const { accessToken, phoneNumberId, displayName } = req.body as { accessToken?: string; phoneNumberId?: string; displayName?: string };
  if (!accessToken?.trim() || !phoneNumberId?.trim()) {
    return res.status(400).json({ error: "Access token and phone number ID are required" });
  }

  // Validate by fetching the phone number info
  const validRes = await fetch(
    `https://graph.facebook.com/v19.0/${phoneNumberId.trim()}?fields=display_phone_number,verified_name&access_token=${accessToken.trim()}`,
  );
  if (!validRes.ok) return res.status(400).json({ error: "Invalid access token or phone number ID" });
  const info = (await validRes.json()) as { display_phone_number?: string; verified_name?: string; error?: { message: string } };
  if (info.error) return res.status(400).json({ error: info.error.message });

  await PlanLimitsEnforcer.check(req.user.orgId, "account");

  const handle = displayName?.trim() || info.verified_name || info.display_phone_number || phoneNumberId.trim();
  const [account] = await db
    .insert(socialAccounts)
    .values({
      organizationId: req.user.orgId,
      platform: "whatsapp",
      accountHandle: handle,
      accountId: phoneNumberId.trim(),
      accessToken: encryptToken(accessToken.trim()),
      platformConfig: { phoneNumberId: phoneNumberId.trim(), displayPhoneNumber: info.display_phone_number },
      isActive: true,
    })
    .onConflictDoUpdate({
      target: [socialAccounts.organizationId, socialAccounts.platform, socialAccounts.accountHandle] as [typeof socialAccounts.organizationId, typeof socialAccounts.platform, typeof socialAccounts.accountHandle],
      set: { accessToken: encryptToken(accessToken.trim()), updatedAt: new Date() },
    })
    .returning();

  await backfillPlanPosts(req.user.orgId, account!.id, "whatsapp");
  return res.json({ id: account!.id, platform: "whatsapp", accountHandle: handle, isActive: true });
});

// POST /accounts/bluesky — connect via AT Protocol identifier + app password
router.post("/bluesky", auth, async (req, res) => {
  const { identifier, appPassword } = req.body as { identifier?: string; appPassword?: string };
  if (!identifier?.trim() || !appPassword?.trim()) {
    return res.status(400).json({ error: "Identifier and app password are required" });
  }

  // Create a session to validate credentials
  const sessionRes = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: identifier.trim(), password: appPassword.trim() }),
  });
  if (!sessionRes.ok) return res.status(400).json({ error: "Invalid Bluesky identifier or app password" });
  const session = (await sessionRes.json()) as { did: string; handle: string; accessJwt: string; refreshJwt: string };

  await PlanLimitsEnforcer.check(req.user.orgId, "account");

  const [account] = await db
    .insert(socialAccounts)
    .values({
      organizationId: req.user.orgId,
      platform: "bluesky",
      accountHandle: session.handle,
      accountId: session.did,
      accessToken: encryptToken(session.accessJwt),
      refreshToken: session.refreshJwt ? encryptToken(session.refreshJwt) : null,
      platformConfig: { did: session.did, handle: session.handle },
      isActive: true,
    })
    .onConflictDoUpdate({
      target: [socialAccounts.organizationId, socialAccounts.platform, socialAccounts.accountHandle] as [typeof socialAccounts.organizationId, typeof socialAccounts.platform, typeof socialAccounts.accountHandle],
      set: { accessToken: encryptToken(session.accessJwt), refreshToken: session.refreshJwt ? encryptToken(session.refreshJwt) : undefined, updatedAt: new Date() },
    })
    .returning();

  await backfillPlanPosts(req.user.orgId, account!.id, "bluesky");
  return res.json({ id: account!.id, platform: "bluesky", accountHandle: session.handle, isActive: true });
});

// POST /accounts/mastodon — connect via instance URL + access token
router.post("/mastodon", auth, async (req, res) => {
  const { instanceUrl, accessToken } = req.body as { instanceUrl?: string; accessToken?: string };
  if (!instanceUrl?.trim() || !accessToken?.trim()) {
    return res.status(400).json({ error: "Instance URL and access token are required" });
  }

  const instance = instanceUrl.trim().replace(/\/$/, "").replace(/^https?:\/\//, "");

  // Validate by fetching the authenticated account
  const verifyRes = await fetch(`https://${instance}/api/v1/accounts/verify_credentials`, {
    headers: { Authorization: `Bearer ${accessToken.trim()}` },
  });
  if (!verifyRes.ok) return res.status(400).json({ error: "Invalid Mastodon token or instance URL" });
  const acct = (await verifyRes.json()) as { id: string; username: string; acct: string };

  await PlanLimitsEnforcer.check(req.user.orgId, "account");

  const handle = `@${acct.acct}`;
  const [account] = await db
    .insert(socialAccounts)
    .values({
      organizationId: req.user.orgId,
      platform: "mastodon",
      accountHandle: handle,
      accountId: acct.id,
      accessToken: encryptToken(accessToken.trim()),
      platformConfig: { instance, accountId: acct.id, username: acct.username },
      isActive: true,
    })
    .onConflictDoUpdate({
      target: [socialAccounts.organizationId, socialAccounts.platform, socialAccounts.accountHandle] as [typeof socialAccounts.organizationId, typeof socialAccounts.platform, typeof socialAccounts.accountHandle],
      set: { accessToken: encryptToken(accessToken.trim()), updatedAt: new Date() },
    })
    .returning();

  await backfillPlanPosts(req.user.orgId, account!.id, "mastodon");
  return res.json({ id: account!.id, platform: "mastodon", accountHandle: handle, isActive: true });
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

async function backfillPlanPosts(orgId: string, accountId: string, platform: string) {
  await db
    .update(scheduledPosts)
    .set({ socialAccountId: accountId })
    .where(
      and(
        eq(scheduledPosts.organizationId, orgId),
        eq(scheduledPosts.platform, platform as any),
        isNull(scheduledPosts.socialAccountId),
      ),
    );
}

export { router as accountsRouter };
