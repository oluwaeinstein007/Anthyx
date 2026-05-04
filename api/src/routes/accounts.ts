import { Router } from "express";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { db } from "../db/client";
import { socialAccounts, organizations, scheduledPosts, agents, brandProfiles, agentSocialAccounts } from "../db/schema";
import { auth } from "../middleware/auth";
import { encryptToken, decryptToken } from "../services/oauth-proxy/crypto";
import { PlanLimitsEnforcer } from "../services/billing/limits";
import type { Platform } from "@anthyx/types";
import { randomBytes, createHash } from "crypto";
import { createConnection } from "net";
import { redisConnection } from "../queue/client";
import { Agent as UndiciAgent } from "undici";
import type { buildConnector } from "undici";

// Force IPv4 for Telegram API calls — Docker containers lack IPv6 routing so
// Node.js Happy Eyeballs tries IPv6 first, gets ENETUNREACH, and the race
// corrupts the IPv4 attempt too, producing ETIMEDOUT.
const tgAgent = new UndiciAgent({ connect: { family: 4 } as buildConnector.BuildOptions });

// Basic TCP reachability check for SMTP (no nodemailer needed at connect time)
function verifySMTPConnectivity(host: string, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`Cannot reach ${host}:${port} — connection timed out`));
    }, 10_000);
    socket.once("connect", () => { clearTimeout(timer); socket.destroy(); resolve(); });
    socket.once("error", (e) => { clearTimeout(timer); reject(new Error(`Cannot connect to SMTP server: ${e.message}`)); });
  });
}

const router = Router();

const OAUTH_STATE_TTL = 10 * 60; // 10 minutes

// GET /accounts/oauth/:platform — generate OAuth URL
router.get("/oauth/:platform", auth, async (req, res) => {
  try {
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
  } catch (err) {
    console.error("[accounts] oauth url error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /accounts/oauth/callback
router.get("/oauth/callback", async (req, res) => {
  try {
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
  } catch (err) {
    console.error("[accounts] oauth callback error:", err);
    return res.redirect(`${process.env["DASHBOARD_URL"]}/accounts?error=connection_failed`);
  }
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

    const tgFetch = (url: string) =>
      fetch(url, { signal: AbortSignal.timeout(10_000), dispatcher: tgAgent } as RequestInit);

    // Validate bot token
    let meRes: Response;
    try {
      meRes = await tgFetch(`https://api.telegram.org/bot${token}/getMe`);
    } catch (e) {
      const msg = e instanceof Error && e.name === "TimeoutError"
        ? "Timed out reaching Telegram API — check your server's outbound network access."
        : "Cannot reach Telegram API — check your network connection.";
      return res.status(502).json({ error: msg });
    }
    const meData = (await meRes.json()) as { ok: boolean; result?: { id: number; username: string; first_name: string } };
    if (!meData.ok) {
      return res.status(400).json({ error: "Invalid bot token. Double-check what @BotFather gave you." });
    }
    const bot = meData.result!;

    // Validate bot has access to the specified chat
    const chatRes = await tgFetch(
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
      const memberRes = await tgFetch(
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
    const platformConfig = {
      chatId: resolvedChatId,
      chatTitle: handle,
      chatType: chatInfo.type,
      botUsername: bot.username,
    };

    // Key = "chatId::botId" — lets same channel host multiple bots with different roles
    // (e.g. one poster bot + one hype/comment bot) as separate accounts.
    const botAccountKey = `${resolvedChatId}::${bot.id}`;

    // 1. Exact match: same channel AND same bot (new key format)
    let existing = await db.query.socialAccounts.findFirst({
      where: and(
        eq(socialAccounts.organizationId, req.user.orgId),
        eq(socialAccounts.platform, "telegram"),
        eq(socialAccounts.accountId, botAccountKey),
      ),
    });

    // 2. Legacy match: old accounts stored just the chatId — migrate if same bot
    if (!existing) {
      const legacy = await db.query.socialAccounts.findFirst({
        where: and(
          eq(socialAccounts.organizationId, req.user.orgId),
          eq(socialAccounts.platform, "telegram"),
          eq(socialAccounts.accountId, resolvedChatId),
        ),
      });
      if (legacy && (legacy.platformConfig as Record<string, unknown>)?.["botUsername"] === bot.username) {
        existing = legacy;
      }
    }

    let account: typeof socialAccounts.$inferSelect;

    if (existing) {
      // Update credentials and migrate accountId to new key format
      const [updated] = await db
        .update(socialAccounts)
        .set({ accountId: botAccountKey, accessToken: encryptToken(token), platformConfig, updatedAt: new Date() })
        .where(eq(socialAccounts.id, existing.id))
        .returning();
      account = updated!;
    } else {
      // New (channel, bot) pair — disambiguate handle if the channel name is already taken
      // by a different bot so the user can tell them apart in the UI.
      const handleConflict = await db.query.socialAccounts.findFirst({
        where: and(
          eq(socialAccounts.organizationId, req.user.orgId),
          eq(socialAccounts.platform, "telegram"),
          eq(socialAccounts.accountHandle, handle),
        ),
      });
      const finalHandle = handleConflict ? `${handle} (@${bot.username})` : handle;

      const [inserted] = await db
        .insert(socialAccounts)
        .values({
          organizationId: req.user.orgId,
          platform: "telegram",
          accountHandle: finalHandle,
          accountId: botAccountKey,
          accessToken: encryptToken(token),
          platformConfig,
          isActive: true,
        })
        .returning();
      account = inserted!;
    }

    await backfillPlanPosts(req.user.orgId, account!.id, "telegram");

    return res.json({
      id: account!.id,
      platform: "telegram",
      accountHandle: account!.accountHandle,
      isActive: true,
    });
  } catch (err) {
    console.error("[accounts] telegram connect error:", err);
    return res.status(500).json({ error: "Failed to connect Telegram bot. Check your token and try again." });
  }
});

// POST /accounts/discord — connect via bot token + channel ID
router.post("/discord", auth, async (req, res) => {
  try {
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
  const botChannelKey = `${ch.id}::${me.id}`;
  const platformConfig = { channelId: ch.id, channelName: ch.name, botUsername: me.username };

  // Same channel + same bot → update; same channel + different bot → new account
  let discordExisting = await db.query.socialAccounts.findFirst({
    where: and(
      eq(socialAccounts.organizationId, req.user.orgId),
      eq(socialAccounts.platform, "discord"),
      eq(socialAccounts.accountId, botChannelKey),
    ),
  });
  // Legacy: old accounts stored just channelId — migrate if same bot
  if (!discordExisting) {
    const legacy = await db.query.socialAccounts.findFirst({
      where: and(
        eq(socialAccounts.organizationId, req.user.orgId),
        eq(socialAccounts.platform, "discord"),
        eq(socialAccounts.accountId, ch.id),
      ),
    });
    if (legacy && (legacy.platformConfig as Record<string, unknown>)?.["botUsername"] === me.username) {
      discordExisting = legacy;
    }
  }

  let discordAccount: typeof socialAccounts.$inferSelect;
  if (discordExisting) {
    const [updated] = await db
      .update(socialAccounts)
      .set({ accountId: botChannelKey, accessToken: encryptToken(botToken.trim()), platformConfig, updatedAt: new Date() })
      .where(eq(socialAccounts.id, discordExisting.id))
      .returning();
    discordAccount = updated!;
  } else {
    const handleConflict = await db.query.socialAccounts.findFirst({
      where: and(
        eq(socialAccounts.organizationId, req.user.orgId),
        eq(socialAccounts.platform, "discord"),
        eq(socialAccounts.accountHandle, handle),
      ),
    });
    const finalHandle = handleConflict ? `${handle} (@${me.username})` : handle;
    const [inserted] = await db
      .insert(socialAccounts)
      .values({
        organizationId: req.user.orgId,
        platform: "discord",
        accountHandle: finalHandle,
        accountId: botChannelKey,
        accessToken: encryptToken(botToken.trim()),
        platformConfig,
        isActive: true,
      })
      .returning();
    discordAccount = inserted!;
  }

  await backfillPlanPosts(req.user.orgId, discordAccount!.id, "discord");
  return res.json({ id: discordAccount!.id, platform: "discord", accountHandle: discordAccount!.accountHandle, isActive: true });
  } catch (err) {
    console.error("[accounts] discord connect error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /accounts/slack — connect via bot OAuth token + channel ID
router.post("/slack", auth, async (req, res) => {
  try {
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
  } catch (err) {
    console.error("[accounts] slack connect error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /accounts/whatsapp — connect via WhatsApp Business Cloud API token + phone number ID
router.post("/whatsapp", auth, async (req, res) => {
  try {
  const { accessToken, phoneNumberId, displayName } = req.body as { accessToken?: string; phoneNumberId?: string; displayName?: string };
  if (!accessToken?.trim() || !phoneNumberId?.trim()) {
    return res.status(400).json({ error: "Access token and phone number ID are required" });
  }

  // Validate by fetching the phone number info
  const validRes = await fetch(
    `https://graph.facebook.com/v19.0/${phoneNumberId.trim()}?fields=display_phone_number,verified_name`,
    { headers: { Authorization: `Bearer ${accessToken.trim()}` } },
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
  } catch (err) {
    console.error("[accounts] whatsapp connect error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /accounts/bluesky — connect via AT Protocol identifier + app password
router.post("/bluesky", auth, async (req, res) => {
  try {
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
  } catch (err) {
    console.error("[accounts] bluesky connect error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /accounts/mastodon — connect via instance URL + access token
router.post("/mastodon", auth, async (req, res) => {
  try {
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
  } catch (err) {
    console.error("[accounts] mastodon connect error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /accounts/pinterest — connect via access token + board ID
router.post("/pinterest", auth, async (req, res) => {
  try {
  const { accessToken, boardId, boardName } = req.body as {
    accessToken?: string;
    boardId?: string;
    boardName?: string;
  };

  if (!accessToken?.trim() || !boardId?.trim()) {
    return res.status(400).json({ error: "Access token and board ID are required" });
  }

  const verifyRes = await fetch("https://api.pinterest.com/v5/user_account", {
    headers: { Authorization: `Bearer ${accessToken.trim()}` },
  });
  if (!verifyRes.ok) return res.status(400).json({ error: "Invalid Pinterest access token" });
  const user = (await verifyRes.json()) as { username?: string };

  const boardRes = await fetch(`https://api.pinterest.com/v5/boards/${encodeURIComponent(boardId.trim())}`, {
    headers: { Authorization: `Bearer ${accessToken.trim()}` },
  });
  if (!boardRes.ok) return res.status(400).json({ error: "Board not found — check the board ID and ensure the token has boards:read scope" });
  const board = (await boardRes.json()) as { id: string; name?: string };

  await PlanLimitsEnforcer.check(req.user.orgId, "account");

  const handle = user.username ?? "pinterest_user";
  const resolvedBoardName = boardName?.trim() || board.name || boardId.trim();

  const [account] = await db
    .insert(socialAccounts)
    .values({
      organizationId: req.user.orgId,
      platform: "pinterest",
      accountHandle: handle,
      accountId: user.username,
      accessToken: encryptToken(accessToken.trim()),
      platformConfig: {
        boardId: board.id,
        boardName: resolvedBoardName,
        username: user.username,
      },
      isActive: true,
    })
    .onConflictDoUpdate({
      target: [socialAccounts.organizationId, socialAccounts.platform, socialAccounts.accountHandle] as [typeof socialAccounts.organizationId, typeof socialAccounts.platform, typeof socialAccounts.accountHandle],
      set: {
        accessToken: encryptToken(accessToken.trim()),
        platformConfig: {
          boardId: board.id,
          boardName: resolvedBoardName,
          username: user.username,
        },
        updatedAt: new Date(),
      },
    })
    .returning();

  await backfillPlanPosts(req.user.orgId, account!.id, "pinterest");
  return res.json({ id: account!.id, platform: "pinterest", accountHandle: handle, isActive: true });
  } catch (err) {
    console.error("[accounts] pinterest connect error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /accounts/email — connect an email account with per-org credentials
router.post("/email", auth, async (req, res) => {
  try {
    const {
      mailer = "smtp",
      displayName,
      fromAddress,
      fromName,
      recipients,
      // SMTP
      host,
      port,
      username,
      password,
      encryption = "tls",
      // SendGrid
      apiKey,
      // Mailgun
      mailgunApiKey,
      mailgunDomain,
    } = req.body as Record<string, string>;

    if (!fromAddress?.trim()) return res.status(400).json({ error: "From address is required" });

    const recipientList = recipients?.trim()
      ? recipients.split(/[\s,]+/).map((r) => r.trim()).filter((r) => r.includes("@"))
      : [];

    let secret: string;
    let cfg: Record<string, unknown>;

    if (mailer === "smtp") {
      if (!host?.trim() || !username?.trim() || !password?.trim()) {
        return res.status(400).json({ error: "SMTP host, username and password are required" });
      }
      const smtpPort = parseInt(port ?? "587", 10);
      const smtpEncryption = encryption ?? "tls";

      try {
        await verifySMTPConnectivity(host.trim(), smtpPort);
      } catch (err) {
        return res.status(400).json({ error: `SMTP connection failed: ${(err as Error).message}` });
      }

      secret = password.trim();
      cfg = {
        mailer: "smtp",
        host: host.trim(),
        port: smtpPort,
        username: username.trim(),
        encryption: smtpEncryption,
        fromAddress: fromAddress.trim(),
        fromName: fromName?.trim() ?? "",
        recipients: recipientList,
      };
    } else if (mailer === "sendgrid") {
      if (!apiKey?.trim()) return res.status(400).json({ error: "SendGrid API key is required" });
      const valRes = await fetch("https://api.sendgrid.com/v3/scopes", {
        headers: { Authorization: `Bearer ${apiKey.trim()}` },
      });
      if (!valRes.ok) return res.status(400).json({ error: "Invalid SendGrid API key" });

      secret = apiKey.trim();
      cfg = {
        mailer: "sendgrid",
        fromAddress: fromAddress.trim(),
        fromName: fromName?.trim() ?? "",
        recipients: recipientList,
      };
    } else if (mailer === "mailgun") {
      if (!mailgunApiKey?.trim() || !mailgunDomain?.trim()) {
        return res.status(400).json({ error: "Mailgun API key and domain are required" });
      }
      const valRes = await fetch(`https://api.mailgun.net/v3/domains/${mailgunDomain.trim()}`, {
        headers: { Authorization: `Basic ${Buffer.from(`api:${mailgunApiKey.trim()}`).toString("base64")}` },
      });
      if (!valRes.ok) return res.status(400).json({ error: "Invalid Mailgun credentials or domain" });

      secret = mailgunApiKey.trim();
      cfg = {
        mailer: "mailgun",
        domain: mailgunDomain.trim(),
        fromAddress: fromAddress.trim(),
        fromName: fromName?.trim() ?? "",
        recipients: recipientList,
      };
    } else {
      return res.status(400).json({ error: `Unsupported mailer: "${mailer}"` });
    }

    await PlanLimitsEnforcer.check(req.user.orgId, "account");

    const handle = displayName?.trim() || fromAddress.trim();

    const [account] = await db
      .insert(socialAccounts)
      .values({
        organizationId: req.user.orgId,
        platform: "email",
        accountHandle: handle,
        accountId: handle,
        accessToken: encryptToken(secret),
        platformConfig: cfg,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: [socialAccounts.organizationId, socialAccounts.platform, socialAccounts.accountHandle] as [typeof socialAccounts.organizationId, typeof socialAccounts.platform, typeof socialAccounts.accountHandle],
        set: { accessToken: encryptToken(secret), platformConfig: cfg, updatedAt: new Date() },
      })
      .returning();

    await backfillPlanPosts(req.user.orgId, account!.id, "email");
    return res.json({ id: account!.id, platform: "email", accountHandle: handle, isActive: true });
  } catch (err) {
    console.error("[accounts] email connect error:", err);
    return res.status(500).json({ error: "Failed to connect email account" });
  }
});

// PUT /accounts/email/:id — edit an existing email account (leave secret blank to keep current)
router.put("/email/:id", auth, async (req, res) => {
  try {
    const existing = await db.query.socialAccounts.findFirst({
      where: and(
        eq(socialAccounts.id, req.params.id!),
        eq(socialAccounts.organizationId, req.user.orgId),
        eq(socialAccounts.platform, "email" as Platform),
      ),
    });
    if (!existing) return res.status(404).json({ error: "Email account not found" });

    const {
      mailer = ((existing.platformConfig as Record<string, unknown>)?.["mailer"] as string) ?? "smtp",
      displayName,
      fromAddress,
      fromName,
      recipients,
      // SMTP
      host,
      port,
      username,
      password,
      encryption,
      // SendGrid
      apiKey,
      // Mailgun
      mailgunApiKey,
      mailgunDomain,
    } = req.body as Record<string, string>;

    if (!fromAddress?.trim()) return res.status(400).json({ error: "From address is required" });

    const existingRecipients = ((existing.platformConfig as Record<string, unknown>)?.["recipients"] as string[]) ?? [];
    const recipientList = recipients?.trim()
      ? recipients.split(/[\s,]+/).map((r) => r.trim()).filter((r) => r.includes("@"))
      : existingRecipients;

    let secret: string | null = null; // null means keep existing
    let cfg: Record<string, unknown>;

    if (mailer === "smtp") {
      const smtpPort = parseInt(port ?? "587", 10);
      const smtpEncryption = encryption ?? "tls";

      if (password?.trim()) {
        if (!host?.trim() || !username?.trim()) {
          return res.status(400).json({ error: "SMTP host and username are required when changing password" });
        }
        try {
          await verifySMTPConnectivity(host.trim(), smtpPort);
        } catch (err) {
          return res.status(400).json({ error: `SMTP connection failed: ${(err as Error).message}` });
        }
        secret = password.trim();
      }

      cfg = {
        mailer: "smtp",
        host: (host?.trim() || (existing.platformConfig as any)?.["host"]) ?? "",
        port: smtpPort,
        username: (username?.trim() || (existing.platformConfig as any)?.["username"]) ?? "",
        encryption: smtpEncryption,
        fromAddress: fromAddress.trim(),
        fromName: fromName?.trim() ?? "",
        recipients: recipientList,
      };
    } else if (mailer === "sendgrid") {
      if (apiKey?.trim()) {
        const valRes = await fetch("https://api.sendgrid.com/v3/scopes", {
          headers: { Authorization: `Bearer ${apiKey.trim()}` },
        });
        if (!valRes.ok) return res.status(400).json({ error: "Invalid SendGrid API key" });
        secret = apiKey.trim();
      }
      cfg = {
        mailer: "sendgrid",
        fromAddress: fromAddress.trim(),
        fromName: fromName?.trim() ?? "",
        recipients: recipientList,
      };
    } else if (mailer === "mailgun") {
      const domain = mailgunDomain?.trim() || ((existing.platformConfig as any)?.["domain"] as string) || "";
      if (mailgunApiKey?.trim()) {
        if (!domain) return res.status(400).json({ error: "Mailgun domain is required" });
        const valRes = await fetch(`https://api.mailgun.net/v3/domains/${domain}`, {
          headers: { Authorization: `Basic ${Buffer.from(`api:${mailgunApiKey.trim()}`).toString("base64")}` },
        });
        if (!valRes.ok) return res.status(400).json({ error: "Invalid Mailgun credentials or domain" });
        secret = mailgunApiKey.trim();
      }
      cfg = {
        mailer: "mailgun",
        domain,
        fromAddress: fromAddress.trim(),
        fromName: fromName?.trim() ?? "",
        recipients: recipientList,
      };
    } else {
      return res.status(400).json({ error: `Unsupported mailer: "${mailer}"` });
    }

    const handle = displayName?.trim() || fromAddress.trim();
    const updateSet: Record<string, unknown> = { platformConfig: cfg, updatedAt: new Date() };
    if (secret !== null) updateSet["accessToken"] = encryptToken(secret);

    const [account] = await db
      .update(socialAccounts)
      .set(updateSet as any)
      .where(and(eq(socialAccounts.id, req.params.id!), eq(socialAccounts.organizationId, req.user.orgId)))
      .returning();

    return res.json({ id: account!.id, platform: "email", accountHandle: account!.accountHandle, isActive: true });
  } catch (err) {
    console.error("[accounts] email update error:", err);
    return res.status(500).json({ error: "Failed to update email account" });
  }
});

// PUT /accounts/telegram/:id — update credentials / target chat for an existing Telegram account
router.put("/telegram/:id", auth, async (req, res) => {
  try {
    const { botToken, chatId } = req.body as { botToken?: string; chatId?: string };
    const chat = chatId?.trim();
    if (!chat) return res.status(400).json({ error: "Chat ID is required" });

    const existing = await db.query.socialAccounts.findFirst({
      where: and(eq(socialAccounts.id, req.params.id!), eq(socialAccounts.organizationId, req.user.orgId)),
    });
    if (!existing) return res.status(404).json({ error: "Account not found" });

    if (!botToken?.trim() && !existing.accessToken) return res.status(400).json({ error: "Bot token is required" });
    const token = botToken?.trim() ?? decryptToken(existing.accessToken!);

    const tgFetch = (url: string) => fetch(url, { signal: AbortSignal.timeout(10_000) });

    let meRes: Response;
    try {
      meRes = await tgFetch(`https://api.telegram.org/bot${token}/getMe`);
    } catch (e) {
      const msg = e instanceof Error && e.name === "TimeoutError"
        ? "Timed out reaching Telegram API — check your server's outbound network access."
        : "Cannot reach Telegram API — check your network connection.";
      return res.status(502).json({ error: msg });
    }
    const meData = (await meRes.json()) as { ok: boolean; result?: { id: number; username: string } };
    if (!meData.ok) return res.status(400).json({ error: "Invalid bot token. Double-check what @BotFather gave you." });
    const bot = meData.result!;

    const chatRes = await tgFetch(`https://api.telegram.org/bot${token}/getChat?chat_id=${encodeURIComponent(chat)}`);
    const chatData = (await chatRes.json()) as { ok: boolean; result?: { id: number; title?: string; username?: string; type: string } };
    if (!chatData.ok) return res.status(400).json({ error: "Bot can't access that chat. Make sure it's been added as an admin." });
    const chatInfo = chatData.result!;

    if (chatInfo.type !== "private") {
      const memberRes = await tgFetch(
        `https://api.telegram.org/bot${token}/getChatMember?chat_id=${encodeURIComponent(chat)}&user_id=${bot.id}`,
      );
      const memberData = (await memberRes.json()) as { ok: boolean; result?: { status: string } };
      const status = memberData.result?.status;
      if (!memberData.ok || !["administrator", "creator"].includes(status ?? "")) {
        return res.status(400).json({ error: "Bot must be an admin of the channel or group to post." });
      }
    }

    const handle = chatInfo.title ?? chatInfo.username ?? `chat_${chatInfo.id}`;
    const resolvedChatId = String(chatInfo.id);

    // If the new chat title collides with a DIFFERENT account, append the chat ID.
    const handleConflict = await db.query.socialAccounts.findFirst({
      where: and(
        eq(socialAccounts.organizationId, req.user.orgId),
        eq(socialAccounts.platform, "telegram"),
        eq(socialAccounts.accountHandle, handle),
      ),
    });
    const finalHandle =
      handleConflict && handleConflict.id !== req.params.id
        ? `${handle} (${resolvedChatId})`
        : handle;

    const updateSet: Record<string, unknown> = {
      accountHandle: finalHandle,
      accountId: resolvedChatId,
      platformConfig: { chatId: resolvedChatId, chatTitle: finalHandle, chatType: chatInfo.type, botUsername: bot.username },
      updatedAt: new Date(),
    };
    if (botToken?.trim()) updateSet["accessToken"] = encryptToken(botToken.trim());

    await db.update(socialAccounts).set(updateSet as any).where(
      and(eq(socialAccounts.id, req.params.id!), eq(socialAccounts.organizationId, req.user.orgId)),
    );
    return res.json({ id: existing.id, platform: "telegram", accountHandle: finalHandle, isActive: true });
  } catch (err) {
    console.error("[accounts] telegram update error:", err);
    return res.status(500).json({ error: "Failed to update Telegram bot. Check your token and try again." });
  }
});

// PUT /accounts/discord/:id — update an existing Discord account
router.put("/discord/:id", auth, async (req, res) => {
  try {
  const { botToken, channelId } = req.body as { botToken?: string; channelId?: string };
  const channel = channelId?.trim();
  if (!channel) return res.status(400).json({ error: "Channel ID is required" });

  const existing = await db.query.socialAccounts.findFirst({
    where: and(eq(socialAccounts.id, req.params.id!), eq(socialAccounts.organizationId, req.user.orgId)),
  });
  if (!existing) return res.status(404).json({ error: "Account not found" });

  if (!botToken?.trim() && !existing.accessToken) return res.status(400).json({ error: "Bot token is required" });
  const token = botToken?.trim() ?? decryptToken(existing.accessToken!);

  const meRes = await fetch("https://discord.com/api/v10/users/@me", {
    headers: { Authorization: `Bot ${token}` },
  });
  if (!meRes.ok) return res.status(400).json({ error: "Invalid Discord bot token" });
  const me = (await meRes.json()) as { id: string; username: string };

  const chRes = await fetch(`https://discord.com/api/v10/channels/${channel}`, {
    headers: { Authorization: `Bot ${token}` },
  });
  if (!chRes.ok) return res.status(400).json({ error: "Bot cannot access that channel — make sure it has been added to the server with Send Messages permission" });
  const ch = (await chRes.json()) as { id: string; name?: string };

  const handle = ch.name ?? `channel_${ch.id}`;
  const updateSet: Record<string, unknown> = {
    accountHandle: handle,
    accountId: ch.id,
    platformConfig: { channelId: ch.id, channelName: ch.name, botUsername: me.username },
    updatedAt: new Date(),
  };
  if (botToken?.trim()) updateSet["accessToken"] = encryptToken(botToken.trim());

  await db.update(socialAccounts).set(updateSet as any).where(
    and(eq(socialAccounts.id, req.params.id!), eq(socialAccounts.organizationId, req.user.orgId)),
  );
  return res.json({ id: existing.id, platform: "discord", accountHandle: handle, isActive: true });
  } catch (err) {
    console.error("[accounts] discord update error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /accounts/slack/:id — update an existing Slack account
router.put("/slack/:id", auth, async (req, res) => {
  try {
  const { botToken, channelId } = req.body as { botToken?: string; channelId?: string };
  const channel = channelId?.trim();
  if (!channel) return res.status(400).json({ error: "Channel ID is required" });

  const existing = await db.query.socialAccounts.findFirst({
    where: and(eq(socialAccounts.id, req.params.id!), eq(socialAccounts.organizationId, req.user.orgId)),
  });
  if (!existing) return res.status(404).json({ error: "Account not found" });

  if (!botToken?.trim() && !existing.accessToken) return res.status(400).json({ error: "Bot token is required" });
  const token = botToken?.trim() ?? decryptToken(existing.accessToken!);

  const authRes = await fetch("https://slack.com/api/auth.test", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const authData = (await authRes.json()) as { ok: boolean; user?: string; team?: string; error?: string };
  if (!authData.ok) return res.status(400).json({ error: `Invalid Slack token: ${authData.error}` });

  const handle = `${authData.team ?? "workspace"}#${channel}`;
  const updateSet: Record<string, unknown> = {
    accountHandle: handle,
    accountId: channel,
    platformConfig: { channelId: channel, workspace: authData.team, botUser: authData.user },
    updatedAt: new Date(),
  };
  if (botToken?.trim()) updateSet["accessToken"] = encryptToken(botToken.trim());

  await db.update(socialAccounts).set(updateSet as any).where(
    and(eq(socialAccounts.id, req.params.id!), eq(socialAccounts.organizationId, req.user.orgId)),
  );
  return res.json({ id: existing.id, platform: "slack", accountHandle: handle, isActive: true });
  } catch (err) {
    console.error("[accounts] slack update error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /accounts/whatsapp/:id — update an existing WhatsApp account
router.put("/whatsapp/:id", auth, async (req, res) => {
  try {
  const { accessToken, phoneNumberId, displayName } = req.body as { accessToken?: string; phoneNumberId?: string; displayName?: string };
  const phoneId = phoneNumberId?.trim();
  if (!phoneId) return res.status(400).json({ error: "Phone number ID is required" });

  const existing = await db.query.socialAccounts.findFirst({
    where: and(eq(socialAccounts.id, req.params.id!), eq(socialAccounts.organizationId, req.user.orgId)),
  });
  if (!existing) return res.status(404).json({ error: "Account not found" });

  if (!accessToken?.trim() && !existing.accessToken) return res.status(400).json({ error: "Access token is required" });
  const token = accessToken?.trim() ?? decryptToken(existing.accessToken!);

  const validRes = await fetch(
    `https://graph.facebook.com/v19.0/${phoneId}?fields=display_phone_number,verified_name`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!validRes.ok) return res.status(400).json({ error: "Invalid access token or phone number ID" });
  const info = (await validRes.json()) as { display_phone_number?: string; verified_name?: string; error?: { message: string } };
  if (info.error) return res.status(400).json({ error: info.error.message });

  const handle = displayName?.trim() || info.verified_name || info.display_phone_number || phoneId;
  const updateSet: Record<string, unknown> = {
    accountHandle: handle,
    accountId: phoneId,
    platformConfig: { phoneNumberId: phoneId, displayPhoneNumber: info.display_phone_number },
    updatedAt: new Date(),
  };
  if (accessToken?.trim()) updateSet["accessToken"] = encryptToken(accessToken.trim());

  await db.update(socialAccounts).set(updateSet as any).where(
    and(eq(socialAccounts.id, req.params.id!), eq(socialAccounts.organizationId, req.user.orgId)),
  );
  return res.json({ id: existing.id, platform: "whatsapp", accountHandle: handle, isActive: true });
  } catch (err) {
    console.error("[accounts] whatsapp update error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /accounts/bluesky/:id — update an existing Bluesky account (always requires new credentials to create a fresh session)
router.put("/bluesky/:id", auth, async (req, res) => {
  try {
  const { identifier, appPassword } = req.body as { identifier?: string; appPassword?: string };
  if (!identifier?.trim() || !appPassword?.trim()) {
    return res.status(400).json({ error: "Identifier and app password are required" });
  }

  const existing = await db.query.socialAccounts.findFirst({
    where: and(eq(socialAccounts.id, req.params.id!), eq(socialAccounts.organizationId, req.user.orgId)),
  });
  if (!existing) return res.status(404).json({ error: "Account not found" });

  const sessionRes = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: identifier.trim(), password: appPassword.trim() }),
  });
  if (!sessionRes.ok) return res.status(400).json({ error: "Invalid Bluesky identifier or app password" });
  const session = (await sessionRes.json()) as { did: string; handle: string; accessJwt: string; refreshJwt: string };

  await db.update(socialAccounts).set({
    accountHandle: session.handle,
    accountId: session.did,
    accessToken: encryptToken(session.accessJwt),
    refreshToken: session.refreshJwt ? encryptToken(session.refreshJwt) : null,
    platformConfig: { did: session.did, handle: session.handle },
    updatedAt: new Date(),
  }).where(
    and(eq(socialAccounts.id, req.params.id!), eq(socialAccounts.organizationId, req.user.orgId)),
  );
  return res.json({ id: existing.id, platform: "bluesky", accountHandle: session.handle, isActive: true });
  } catch (err) {
    console.error("[accounts] bluesky update error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /accounts/mastodon/:id — update an existing Mastodon account
router.put("/mastodon/:id", auth, async (req, res) => {
  try {
  const { instanceUrl, accessToken } = req.body as { instanceUrl?: string; accessToken?: string };
  const rawInstance = instanceUrl?.trim();
  if (!rawInstance) return res.status(400).json({ error: "Instance URL is required" });

  const existing = await db.query.socialAccounts.findFirst({
    where: and(eq(socialAccounts.id, req.params.id!), eq(socialAccounts.organizationId, req.user.orgId)),
  });
  if (!existing) return res.status(404).json({ error: "Account not found" });

  const instance = rawInstance.replace(/\/$/, "").replace(/^https?:\/\//, "");
  if (!accessToken?.trim() && !existing.accessToken) return res.status(400).json({ error: "Access token is required" });
  const token = accessToken?.trim() ?? decryptToken(existing.accessToken!);

  const verifyRes = await fetch(`https://${instance}/api/v1/accounts/verify_credentials`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!verifyRes.ok) return res.status(400).json({ error: "Invalid Mastodon token or instance URL" });
  const acct = (await verifyRes.json()) as { id: string; username: string; acct: string };

  const handle = `@${acct.acct}`;
  const updateSet: Record<string, unknown> = {
    accountHandle: handle,
    accountId: acct.id,
    platformConfig: { instance, accountId: acct.id, username: acct.username },
    updatedAt: new Date(),
  };
  if (accessToken?.trim()) updateSet["accessToken"] = encryptToken(accessToken.trim());

  await db.update(socialAccounts).set(updateSet as any).where(
    and(eq(socialAccounts.id, req.params.id!), eq(socialAccounts.organizationId, req.user.orgId)),
  );
  return res.json({ id: existing.id, platform: "mastodon", accountHandle: handle, isActive: true });
  } catch (err) {
    console.error("[accounts] mastodon update error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /accounts/pinterest/:id — update an existing Pinterest account
router.put("/pinterest/:id", auth, async (req, res) => {
  try {
  const { accessToken, boardId, boardName } = req.body as { accessToken?: string; boardId?: string; boardName?: string };
  const board = boardId?.trim();
  if (!board) return res.status(400).json({ error: "Board ID is required" });

  const existing = await db.query.socialAccounts.findFirst({
    where: and(eq(socialAccounts.id, req.params.id!), eq(socialAccounts.organizationId, req.user.orgId)),
  });
  if (!existing) return res.status(404).json({ error: "Account not found" });

  if (!accessToken?.trim() && !existing.accessToken) return res.status(400).json({ error: "Access token is required" });
  const token = accessToken?.trim() ?? decryptToken(existing.accessToken!);

  const verifyRes = await fetch("https://api.pinterest.com/v5/user_account", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!verifyRes.ok) return res.status(400).json({ error: "Invalid Pinterest access token" });
  const user = (await verifyRes.json()) as { username?: string };

  const boardRes = await fetch(`https://api.pinterest.com/v5/boards/${encodeURIComponent(board)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!boardRes.ok) return res.status(400).json({ error: "Board not found — check the board ID and ensure the token has boards:read scope" });
  const boardData = (await boardRes.json()) as { id: string; name?: string };

  const handle = user.username ?? "pinterest_user";
  const resolvedBoardName = boardName?.trim() || boardData.name || board;
  const updateSet: Record<string, unknown> = {
    accountHandle: handle,
    accountId: user.username,
    platformConfig: { boardId: boardData.id, boardName: resolvedBoardName, username: user.username },
    updatedAt: new Date(),
  };
  if (accessToken?.trim()) updateSet["accessToken"] = encryptToken(accessToken.trim());

  await db.update(socialAccounts).set(updateSet as any).where(
    and(eq(socialAccounts.id, req.params.id!), eq(socialAccounts.organizationId, req.user.orgId)),
  );
  return res.json({ id: existing.id, platform: "pinterest", accountHandle: handle, isActive: true });
  } catch (err) {
    console.error("[accounts] pinterest update error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /accounts
router.get("/", auth, async (req, res) => {
  try {
  const list = await db.query.socialAccounts.findMany({
    where: eq(socialAccounts.organizationId, req.user.orgId),
  });

  const accountIds = list.map((a) => a.id);

  // Batch-fetch agent assignments and brand names
  const [assignmentRows, brandRows] = await Promise.all([
    accountIds.length > 0
      ? db.query.agentSocialAccounts.findMany({
          where: inArray(agentSocialAccounts.socialAccountId, accountIds),
        })
      : Promise.resolve([]),
    (() => {
      const brandIds = [...new Set(list.map((a) => a.brandProfileId).filter(Boolean) as string[])];
      return brandIds.length > 0
        ? db.query.brandProfiles.findMany({ where: inArray(brandProfiles.id, brandIds) })
        : Promise.resolve([]);
    })(),
  ]);

  const agentIds = [...new Set(assignmentRows.map((r) => r.agentId))];
  const agentRows = agentIds.length > 0
    ? await db.query.agents.findMany({ where: inArray(agents.id, agentIds) })
    : [];

  const agentMap = new Map(agentRows.map((a) => [a.id, { id: a.id, name: a.name }]));
  const brandMap = new Map(brandRows.map((b) => [b.id, b.name]));

  // Group agents by socialAccountId
  const agentsByAccount = new Map<string, { id: string; name: string }[]>();
  for (const row of assignmentRows) {
    const agent = agentMap.get(row.agentId);
    if (!agent) continue;
    const arr = agentsByAccount.get(row.socialAccountId) ?? [];
    arr.push(agent);
    agentsByAccount.set(row.socialAccountId, arr);
  }

  return res.json(
    list.map(({ accessToken, refreshToken, ...rest }) => ({
      ...rest,
      brandName: rest.brandProfileId ? (brandMap.get(rest.brandProfileId) ?? null) : null,
      agents: agentsByAccount.get(rest.id) ?? [],
    })),
  );
  } catch (err) {
    console.error("[accounts] list error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /accounts/:id/assign — assign account to a brand and a set of agents
// Body: { brandId: string | null, agentIds: string[] }
// Pass brandId=null + agentIds=[] to fully unassign.
router.put("/:id/assign", auth, async (req, res) => {
  try {
  const { brandId, agentIds = [] } = req.body as { brandId?: string | null; agentIds?: string[] };

  if (!brandId && agentIds.length > 0) {
    return res.status(400).json({ error: "agentIds requires a brandId" });
  }

  const account = await db.query.socialAccounts.findFirst({
    where: and(eq(socialAccounts.id, req.params.id!), eq(socialAccounts.organizationId, req.user.orgId)),
  });
  if (!account) return res.status(404).json({ error: "Account not found" });

  if (brandId) {
    const brand = await db.query.brandProfiles.findFirst({
      where: and(eq(brandProfiles.id, brandId), eq(brandProfiles.organizationId, req.user.orgId)),
    });
    if (!brand) return res.status(404).json({ error: "Brand not found" });
  }

  // Validate that all agentIds belong to this org (and to the brand if specified)
  let resolvedAgentIds: string[] = [];
  if (agentIds.length > 0) {
    const agentRows = await db.query.agents.findMany({
      where: and(
        inArray(agents.id, agentIds),
        eq(agents.organizationId, req.user.orgId),
        ...(brandId ? [eq(agents.brandProfileId, brandId)] : []),
      ),
    });
    if (agentRows.length !== agentIds.length) {
      return res.status(400).json({ error: "One or more agents not found or not in this brand" });
    }
    resolvedAgentIds = agentRows.map((a) => a.id);
  }

  await db.transaction(async (tx) => {
    await tx
      .update(socialAccounts)
      .set({ brandProfileId: brandId ?? null, updatedAt: new Date() })
      .where(and(eq(socialAccounts.id, req.params.id!), eq(socialAccounts.organizationId, req.user.orgId)));

    await tx
      .delete(agentSocialAccounts)
      .where(eq(agentSocialAccounts.socialAccountId, req.params.id!));

    if (resolvedAgentIds.length > 0) {
      await tx.insert(agentSocialAccounts).values(
        resolvedAgentIds.map((agentId, i) => ({
          agentId,
          socialAccountId: req.params.id!,
          isDefault: i === 0,
        })),
      );
    }
  });

  return res.json({ ok: true });
  } catch (err) {
    console.error("[accounts] assign error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /accounts/:id
router.delete("/:id", auth, async (req, res) => {
  try {
  await db
    .delete(socialAccounts)
    .where(
      and(
        eq(socialAccounts.id, req.params.id!),
        eq(socialAccounts.organizationId, req.user.orgId),
      ),
    );
  return res.json({ ok: true });
  } catch (err) {
    console.error("[accounts] delete error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
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

  const meRes = await fetch("https://graph.facebook.com/me?fields=name", { headers: { Authorization: `Bearer ${data.access_token}` } });
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

async function exchangeRedditCode(code: string) {
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env["REDDIT_CLIENT_ID"]}:${process.env["REDDIT_CLIENT_SECRET"]}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Anthyx/1.0",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env["REDDIT_CALLBACK_URL"]!,
    }),
  });
  const data = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
  const meRes = await fetch("https://oauth.reddit.com/api/v1/me", {
    headers: { Authorization: `Bearer ${data.access_token}`, "User-Agent": "Anthyx/1.0" },
  });
  const me = (await meRes.json()) as { name?: string };
  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresIn: data.expires_in, handle: me.name ?? "reddit_user" };
}

async function exchangeThreadsCode(code: string) {
  const res = await fetch("https://graph.threads.net/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env["THREADS_APP_ID"]!,
      client_secret: process.env["THREADS_APP_SECRET"]!,
      grant_type: "authorization_code",
      redirect_uri: process.env["THREADS_CALLBACK_URL"]!,
      code,
    }),
  });
  const data = (await res.json()) as { access_token: string; user_id: string };
  const profileRes = await fetch(
    "https://graph.threads.net/v1.0/me?fields=id,username",
    { headers: { Authorization: `Bearer ${data.access_token}` } },
  );
  const profile = (await profileRes.json()) as { id: string; username?: string };
  return { accessToken: data.access_token, accountId: data.user_id, handle: profile.username ?? "threads_user" };
}

async function exchangeYouTubeCode(code: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env["GOOGLE_CLIENT_ID"]!,
      client_secret: process.env["GOOGLE_CLIENT_SECRET"]!,
      redirect_uri: process.env["GOOGLE_CALLBACK_URL"]!,
      grant_type: "authorization_code",
    }),
  });
  const data = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
  const channelRes = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
    { headers: { Authorization: `Bearer ${data.access_token}` } },
  );
  const channelData = (await channelRes.json()) as { items?: Array<{ id: string; snippet: { title: string } }> };
  const channel = channelData.items?.[0];
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    accountId: channel?.id,
    handle: channel?.snippet.title ?? "youtube_channel",
  };
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
