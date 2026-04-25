import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { createRequire } from "module";
import path from "path";
import { pathToFileURL } from "url";
import { db } from "../db/client";
import { socialAccounts } from "../db/schema";
import { auth } from "../middleware/auth";
import { decryptToken } from "../services/oauth-proxy/crypto";

const router = Router();

let _smcpRoot: string | undefined;
function smcpDistRoot(): string {
  if (!_smcpRoot) {
    const req = createRequire(__filename);
    _smcpRoot = path.dirname(req.resolve("social-mcp"));
  }
  return _smcpRoot!;
}

async function importSvc<T>(name: string): Promise<T> {
  const url = pathToFileURL(path.join(smcpDistRoot(), `services/${name}.js`)).href;
  return import(url) as Promise<T>;
}

interface NormalizedMessage {
  id: string;
  platform: string;
  accountId: string;
  authorHandle: string;
  content: string;
  createdAt: string;
  replied: boolean;
  sourceType: "message" | "mention" | "post";
}

type SocialAccount = {
  id: string;
  platform: string;
  accessToken: string | null;
  accountId: string | null;
  accountHandle: string;
  platformConfig: unknown;
};

async function fetchForAccount(account: SocialAccount): Promise<NormalizedMessage[]> {
  if (!account.accessToken) return [];
  const token = decryptToken(account.accessToken);
  const cfg = (account.platformConfig ?? {}) as Record<string, unknown>;

  try {
    switch (account.platform) {
      case "discord": {
        const channelId = cfg["channelId"] as string | undefined;
        if (!channelId) return [];
        const { DiscordService } = await importSvc<{
          DiscordService: new (c: { botToken: string }) => {
            getMessages(id: string, limit?: number): Promise<Array<{ id: string; content: string; timestamp: string }>>;
          };
        }>("discord-service");
        const msgs = await new DiscordService({ botToken: token }).getMessages(channelId, 20);
        return msgs.map((m) => ({
          id: m.id,
          platform: "discord",
          accountId: account.id,
          authorHandle: cfg["channelName"] as string ?? channelId,
          content: m.content,
          createdAt: m.timestamp,
          replied: false,
          sourceType: "message" as const,
        }));
      }

      case "slack": {
        const channelId = cfg["channelId"] as string | undefined;
        if (!channelId) return [];
        const { SlackService } = await importSvc<{
          SlackService: new (c: { botToken: string }) => {
            getMessages(id: string, limit?: number): Promise<Array<{ ts?: string; userId?: string; text?: string }>>;
          };
        }>("slack-service");
        const msgs = await new SlackService({ botToken: token }).getMessages(channelId, 20);
        return msgs.map((m) => ({
          id: m.ts ?? `slack_${Date.now()}`,
          platform: "slack",
          accountId: account.id,
          authorHandle: m.userId ?? "unknown",
          content: m.text ?? "",
          createdAt: m.ts ? new Date(parseFloat(m.ts) * 1000).toISOString() : new Date().toISOString(),
          replied: false,
          sourceType: "message" as const,
        }));
      }

      case "x": {
        const handle = account.accountHandle.replace(/^@/, "");
        const res = await fetch(
          `https://api.twitter.com/2/tweets/search/recent?query=%40${encodeURIComponent(handle)}&max_results=20&tweet.fields=author_id,created_at,text`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) return [];
        const data = (await res.json()) as {
          data?: Array<{ id: string; text: string; author_id: string; created_at: string }>;
        };
        return (data.data ?? []).map((t) => ({
          id: t.id,
          platform: "x",
          accountId: account.id,
          authorHandle: t.author_id,
          content: t.text,
          createdAt: t.created_at,
          replied: false,
          sourceType: "mention" as const,
        }));
      }

      case "mastodon": {
        const instance = cfg["instance"] as string | undefined;
        if (!instance) return [];
        const notifRes = await fetch(`https://${instance}/api/v1/notifications?types[]=mention&limit=20`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!notifRes.ok) return [];
        const notifs = (await notifRes.json()) as Array<{
          id: string;
          status?: { id: string; content: string; created_at: string };
          account?: { acct: string };
        }>;
        return notifs
          .filter((n) => n.status)
          .map((n) => ({
            id: n.status!.id,
            platform: "mastodon",
            accountId: account.id,
            authorHandle: n.account?.acct ?? "unknown",
            content: n.status!.content.replace(/<[^>]+>/g, ""),
            createdAt: n.status!.created_at,
            replied: false,
            sourceType: "mention" as const,
          }));
      }

      case "instagram": {
        const userId = account.accountId;
        if (!userId) return [];
        const { InstagramService } = await importSvc<{
          InstagramService: new (c: { accessToken: string }) => {
            getPosts(uid: string, limit?: number): Promise<{
              data: Array<{ id: string; caption?: string; media_type: string; timestamp: string }>;
            }>;
          };
        }>("instagram-service");
        const { data: posts } = await new InstagramService({ accessToken: token }).getPosts(userId, 10);
        return posts.map((p) => ({
          id: p.id,
          platform: "instagram",
          accountId: account.id,
          authorHandle: account.accountHandle,
          content: p.caption ?? `[${p.media_type}]`,
          createdAt: p.timestamp,
          replied: false,
          sourceType: "post" as const,
        }));
      }

      case "facebook": {
        const pageId = account.accountId;
        if (!pageId) return [];
        const { FacebookService } = await importSvc<{
          FacebookService: new (c: { accessToken: string }) => {
            getPosts(pid: string, limit?: number): Promise<{
              data: Array<{ id: string; message?: string; created_time: string }>;
            }>;
          };
        }>("facebook-service");
        const { data: posts } = await new FacebookService({ accessToken: token }).getPosts(pageId, 10);
        return posts.map((p) => ({
          id: p.id,
          platform: "facebook",
          accountId: account.id,
          authorHandle: account.accountHandle,
          content: p.message ?? "[Facebook post]",
          createdAt: p.created_time,
          replied: false,
          sourceType: "post" as const,
        }));
      }

      case "linkedin": {
        const authorUrn = account.accountId;
        if (!authorUrn) return [];
        const { LinkedInService } = await importSvc<{
          LinkedInService: new (c: { accessToken: string }) => {
            getPosts(urn: string, count?: number): Promise<{
              elements: Array<{
                id: string;
                created?: { time: number };
                specificContent?: {
                  "com.linkedin.ugc.ShareContent"?: { shareCommentary?: { text: string } };
                };
              }>;
            }>;
          };
        }>("linkedin-service");
        const { elements } = await new LinkedInService({ accessToken: token }).getPosts(authorUrn, 10);
        return elements.map((el) => ({
          id: el.id,
          platform: "linkedin",
          accountId: account.id,
          authorHandle: account.accountHandle,
          content:
            el.specificContent?.["com.linkedin.ugc.ShareContent"]?.shareCommentary?.text ??
            "[LinkedIn post]",
          createdAt: el.created?.time ? new Date(el.created.time).toISOString() : new Date().toISOString(),
          replied: false,
          sourceType: "post" as const,
        }));
      }

      case "threads": {
        const userId = account.accountId;
        if (!userId) return [];
        const { ThreadsService } = await importSvc<{
          ThreadsService: new (c: { accessToken: string; userId: string }) => {
            getPosts(limit?: number): Promise<{ data: Array<{ id: string; text?: string; timestamp?: string }> }>;
          };
        }>("threads-service");
        const { data: posts } = await new ThreadsService({ accessToken: token, userId }).getPosts(10);
        return posts.map((p) => ({
          id: p.id,
          platform: "threads",
          accountId: account.id,
          authorHandle: account.accountHandle,
          content: p.text ?? "[Threads post]",
          createdAt: p.timestamp ?? new Date().toISOString(),
          replied: false,
          sourceType: "post" as const,
        }));
      }

      default:
        return [];
    }
  } catch (err) {
    console.error(
      `[inbox] fetch error for ${account.platform}/${account.accountHandle}:`,
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

// GET /inbox — cross-platform mentions, messages, and recent posts
router.get("/", auth, async (req, res) => {
  const { platform, limit: limitStr, offset: offsetStr } = req.query as Record<string, string | undefined>;
  const limit = Math.min(parseInt(limitStr ?? "50", 10), 200);
  const offset = parseInt(offsetStr ?? "0", 10);

  const accounts = await db.query.socialAccounts.findMany({
    where: and(
      eq(socialAccounts.organizationId, req.user.orgId),
      eq(socialAccounts.isActive, true),
      ...(platform ? [eq(socialAccounts.platform, platform as never)] : []),
    ),
  });

  const results = await Promise.allSettled(accounts.map(fetchForAccount));

  const messages: NormalizedMessage[] = results
    .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const paginated = messages.slice(offset, offset + limit);

  return res.json({
    messages: paginated,
    connectedAccounts: accounts.map((a) => ({ id: a.id, platform: a.platform, handle: a.accountHandle })),
    total: messages.length,
    limit,
    offset,
  });
});

// POST /inbox/:messageId/reply
router.post("/:messageId/reply", auth, async (req, res) => {
  const { content, platform, socialAccountId } = req.body as {
    content: string;
    platform: string;
    socialAccountId: string;
  };
  const messageId = req.params.messageId as string;

  if (!content || !platform || !socialAccountId) {
    return res.status(400).json({ error: "content, platform, and socialAccountId are required" });
  }

  const account = await db.query.socialAccounts.findFirst({
    where: and(
      eq(socialAccounts.id, socialAccountId),
      eq(socialAccounts.organizationId, req.user.orgId),
    ),
  });
  if (!account) return res.status(404).json({ error: "Social account not found" });
  if (!account.accessToken) return res.status(400).json({ error: "Account has no stored credentials" });

  const token = decryptToken(account.accessToken);
  const cfg = (account.platformConfig ?? {}) as Record<string, unknown>;

  switch (platform) {
    case "discord": {
      const channelId = cfg["channelId"] as string | undefined;
      if (!channelId) return res.status(400).json({ error: "No channel configured for this Discord account" });
      const { DiscordService } = await importSvc<{
        DiscordService: new (c: { botToken: string }) => {
          sendMessage(channelId: string, content: string): Promise<unknown>;
        };
      }>("discord-service");
      await new DiscordService({ botToken: token }).sendMessage(channelId, content);
      break;
    }

    case "slack": {
      const channelId = cfg["channelId"] as string | undefined;
      if (!channelId) return res.status(400).json({ error: "No channel configured for this Slack account" });
      const { SlackService } = await importSvc<{
        SlackService: new (c: { botToken: string }) => {
          sendMessage(channelId: string, content: string): Promise<unknown>;
        };
      }>("slack-service");
      await new SlackService({ botToken: token }).sendMessage(channelId, content);
      break;
    }

    case "mastodon": {
      const instance = cfg["instance"] as string | undefined;
      if (!instance) return res.status(400).json({ error: "No instance configured for this Mastodon account" });
      const { MastodonService } = await importSvc<{
        MastodonService: new (c: { accessToken: string; instanceUrl?: string }) => {
          replyToPost(status: string, inReplyToId: string, visibility?: string): Promise<unknown>;
        };
      }>("mastodon-service");
      await new MastodonService({ accessToken: token, instanceUrl: `https://${instance}` }).replyToPost(
        content,
        messageId,
        "public",
      );
      break;
    }

    case "x": {
      const replyRes = await fetch("https://api.twitter.com/2/tweets", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text: content, reply: { in_reply_to_tweet_id: messageId } }),
      });
      if (!replyRes.ok) {
        const err = await replyRes.text();
        return res.status(502).json({ error: `X reply failed: ${err}` });
      }
      break;
    }

    case "linkedin": {
      const authorUrn = account.accountId;
      if (!authorUrn) return res.status(400).json({ error: "No LinkedIn URN stored for this account" });
      const { LinkedInService } = await importSvc<{
        LinkedInService: new (c: { accessToken: string }) => {
          addComment(actorUrn: string, ugcPostUrn: string, text: string): Promise<unknown>;
        };
      }>("linkedin-service");
      await new LinkedInService({ accessToken: token }).addComment(authorUrn, messageId, content);
      break;
    }

    default:
      return res.status(400).json({ error: `Reply not yet supported for platform: ${platform}` });
  }

  return res.json({ replied: true, messageId, platform });
});

export { router as inboxRouter };
