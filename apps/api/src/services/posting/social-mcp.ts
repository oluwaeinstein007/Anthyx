/**
 * Unified social publishing adapter.
 * Single point of import for all platform posting — no other file should
 * call platform APIs directly for publishing.
 */

import type { Platform } from "@anthyx/types";
import type { Agent } from "https-proxy-agent";
import nodemailer from "nodemailer"; // SMTP engine — same dep social-mcp ships internally

export interface PublishPayload {
  platform: Platform;
  accessToken: string;
  content: string;
  hashtags?: string[];
  mediaUrls?: string[];
  accountId?: string;
  proxyAgent?: Agent;
  userAgent?: string;
  // Reddit-specific
  subreddit?: string;
  // YouTube-specific
  videoTitle?: string;
  // Mastodon-specific
  mastodonInstance?: string;
  // Bluesky-specific
  blueskyDid?: string;
  // Pinterest-specific
  pinterestBoardId?: string;
  // Email-specific (credentials come from server process.env, same pattern as Telegram)
  emailTo?: string[];
}

export interface PublishResult {
  postId: string;
  url?: string;
}

export interface EngagementData {
  likes: number;
  reposts: number;
  comments: number;
  impressions: number;
  clicks: number;
  raw: Record<string, unknown>;
}

export async function publishPost(payload: PublishPayload): Promise<PublishResult> {
  switch (payload.platform) {
    case "x":
      return publishToX(payload);
    case "instagram":
      return publishToInstagram(payload);
    case "linkedin":
      return publishToLinkedIn(payload);
    case "telegram":
      return publishToTelegram(payload);
    case "facebook":
      return publishToFacebook(payload);
    case "tiktok":
      return publishToTikTok(payload);
    case "discord":
      return publishToDiscord(payload);
    case "whatsapp":
      return publishToWhatsApp(payload);
    case "slack":
      return publishToSlack(payload);
    case "reddit":
      return publishToReddit(payload);
    case "threads":
      return publishToThreads(payload);
    case "bluesky":
      return publishToBluesky(payload);
    case "mastodon":
      return publishToMastodon(payload);
    case "youtube":
      return publishToYouTube(payload);
    case "pinterest":
      return publishToPinterest(payload);
    case "email":
      return publishToEmail(payload);
    default:
      throw new Error(`Platform ${(payload as PublishPayload).platform} not supported`);
  }
}

export async function fetchEngagementData(
  platform: Platform,
  postId: string,
  accessToken: string,
): Promise<EngagementData> {
  switch (platform) {
    case "x": {
      const res = await fetch(
        `https://api.twitter.com/2/tweets/${postId}?tweet.fields=public_metrics`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!res.ok) throw new Error(`Twitter metrics failed: ${res.status}`);
      const data = (await res.json()) as {
        data: { public_metrics: { like_count: number; retweet_count: number; reply_count: number; impression_count: number } };
      };
      const m = data.data.public_metrics;
      return { likes: m.like_count, reposts: m.retweet_count, comments: m.reply_count, impressions: m.impression_count, clicks: 0, raw: data as unknown as Record<string, unknown> };
    }
    case "instagram": {
      const res = await fetch(
        `https://graph.instagram.com/${postId}/insights?metric=likes,comments,impressions,reach&access_token=${accessToken}`,
      );
      if (!res.ok) throw new Error(`Instagram metrics failed: ${res.status}`);
      const data = (await res.json()) as { data: Array<{ name: string; values: Array<{ value: number }> }> };
      const get = (name: string) => data.data.find((d) => d.name === name)?.values[0]?.value ?? 0;
      return { likes: get("likes"), reposts: 0, comments: get("comments"), impressions: get("impressions"), clicks: 0, raw: data as unknown as Record<string, unknown> };
    }
    case "facebook": {
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${postId}/insights?metric=post_reactions_by_type_total,post_comments,post_impressions&access_token=${accessToken}`,
      );
      if (!res.ok) throw new Error(`Facebook metrics failed: ${res.status}`);
      const data = (await res.json()) as { data: Array<{ name: string; values: Array<{ value: number | Record<string, number> }> }> };
      const get = (name: string): number => {
        const entry = data.data.find((d) => d.name === name)?.values[0]?.value;
        if (typeof entry === "number") return entry;
        if (typeof entry === "object" && entry !== null) return Object.values(entry).reduce((a, b) => a + b, 0);
        return 0;
      };
      return { likes: get("post_reactions_by_type_total"), reposts: 0, comments: get("post_comments"), impressions: get("post_impressions"), clicks: 0, raw: data as unknown as Record<string, unknown> };
    }
    case "linkedin": {
      const res = await fetch(
        `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(postId)}/likes?count=50`,
        { headers: { Authorization: `Bearer ${accessToken}`, "X-Restli-Protocol-Version": "2.0.0" } },
      );
      if (!res.ok) throw new Error(`LinkedIn metrics failed: ${res.status}`);
      const data = (await res.json()) as { paging: { total: number } };
      return { likes: data.paging?.total ?? 0, reposts: 0, comments: 0, impressions: 0, clicks: 0, raw: data as unknown as Record<string, unknown> };
    }
    default:
      return { likes: 0, reposts: 0, comments: 0, impressions: 0, clicks: 0, raw: {} };
  }
}

// ── Platform implementations ──────────────────────────────────────────────────

async function publishToX(p: PublishPayload): Promise<PublishResult> {
  const body: Record<string, unknown> = { text: p.content };
  if (p.mediaUrls?.length) body["media"] = { media_ids: [] };

  const res = await fetch("https://api.twitter.com/2/tweets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${p.accessToken}`,
      "Content-Type": "application/json",
      ...(p.userAgent ? { "User-Agent": p.userAgent } : {}),
    },
    body: JSON.stringify(body),
    ...(p.proxyAgent ? { agent: p.proxyAgent } : {}),
  } as RequestInit);

  if (!res.ok) throw new Error(`X publish failed: ${res.status} - ${await res.text()}`);
  const data = (await res.json()) as { data: { id: string } };
  return { postId: data.data.id, url: `https://x.com/i/web/status/${data.data.id}` };
}

async function publishToInstagram(p: PublishPayload): Promise<PublishResult> {
  if (!p.accountId) throw new Error("Instagram requires accountId");

  const containerBody: Record<string, string> = {
    caption: p.content,
    access_token: p.accessToken,
    media_type: p.mediaUrls?.[0] ? "IMAGE" : "TEXT",
  };
  if (p.mediaUrls?.[0]) containerBody["image_url"] = p.mediaUrls[0];

  const containerRes = await fetch(`https://graph.instagram.com/v18.0/${p.accountId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(containerBody),
  });
  if (!containerRes.ok) throw new Error(`Instagram container failed: ${containerRes.status}`);
  const container = (await containerRes.json()) as { id: string };

  const publishRes = await fetch(`https://graph.instagram.com/v18.0/${p.accountId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: container.id, access_token: p.accessToken }),
  });
  if (!publishRes.ok) throw new Error(`Instagram publish failed: ${publishRes.status}`);
  const pub = (await publishRes.json()) as { id: string };

  // Post hashtags as first comment if provided
  if (p.hashtags?.length && pub.id) {
    const commentText = p.hashtags.map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" ");
    await fetch(`https://graph.instagram.com/v18.0/${pub.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: commentText, access_token: p.accessToken }),
    }).catch(() => {}); // non-fatal if comment fails
  }

  return { postId: pub.id };
}

async function publishToLinkedIn(p: PublishPayload): Promise<PublishResult> {
  const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${p.accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
      ...(p.userAgent ? { "User-Agent": p.userAgent } : {}),
    },
    body: JSON.stringify({
      author: `urn:li:organization:${p.accountId}`,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: p.content },
          shareMediaCategory: "NONE",
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    }),
  } as RequestInit);

  if (!res.ok) throw new Error(`LinkedIn publish failed: ${res.status}`);
  const data = (await res.json()) as { id: string };
  return { postId: data.id };
}

async function publishToTelegram(p: PublishPayload): Promise<PublishResult> {
  const botToken = process.env["TELEGRAM_BOT_TOKEN"];
  if (!botToken || !p.accountId) throw new Error("Telegram requires bot token and accountId");

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: p.accountId, text: p.content, parse_mode: "Markdown" }),
  });

  if (!res.ok) throw new Error(`Telegram publish failed: ${res.status}`);
  const data = (await res.json()) as { result: { message_id: number } };
  return { postId: String(data.result.message_id) };
}

async function publishToFacebook(p: PublishPayload): Promise<PublishResult> {
  if (!p.accountId) throw new Error("Facebook requires accountId (page ID)");

  const body: Record<string, string> = {
    message: p.content,
    access_token: p.accessToken,
  };
  if (p.mediaUrls?.[0]) body["link"] = p.mediaUrls[0];

  const res = await fetch(`https://graph.facebook.com/v19.0/${p.accountId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Facebook publish failed: ${res.status} - ${await res.text()}`);
  const data = (await res.json()) as { id: string };
  return { postId: data.id };
}

async function publishToTikTok(p: PublishPayload): Promise<PublishResult> {
  if (!p.accountId) throw new Error("TikTok requires accountId (open_id)");

  // TikTok Content Posting API v2 — photo post (caption-only requires a video or photo)
  // Using the direct post API for text captions attached to uploaded video
  const res = await fetch("https://open.tiktokapis.com/v2/post/publish/content/init/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${p.accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      post_info: {
        title: p.content,
        privacy_level: "PUBLIC_TO_EVERYONE",
        disable_comment: false,
        disable_duet: false,
        disable_stitch: false,
      },
      source_info: {
        source: "PULL_FROM_URL",
        video_url: p.mediaUrls?.[0] ?? "",
      },
    }),
  });

  if (!res.ok) throw new Error(`TikTok publish failed: ${res.status} - ${await res.text()}`);
  const data = (await res.json()) as { data: { publish_id: string } };
  return { postId: data.data.publish_id };
}

async function publishToDiscord(p: PublishPayload): Promise<PublishResult> {
  // accountId = Discord channel ID; accessToken = bot token
  if (!p.accountId) throw new Error("Discord requires accountId (channel ID)");

  const body: Record<string, unknown> = { content: p.content };
  if (p.mediaUrls?.length) {
    body["embeds"] = [{ image: { url: p.mediaUrls[0] } }];
  }

  const res = await fetch(`https://discord.com/api/v10/channels/${p.accountId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${p.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Discord publish failed: ${res.status} - ${await res.text()}`);
  const data = (await res.json()) as { id: string };
  return { postId: data.id };
}

async function publishToWhatsApp(p: PublishPayload): Promise<PublishResult> {
  // WhatsApp Business Cloud API
  if (!p.accountId) throw new Error("WhatsApp requires accountId (phone number ID)");

  const body: Record<string, unknown> = {
    messaging_product: "whatsapp",
    to: p.accountId,
    type: "text",
    text: { body: p.content },
  };

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${p.accountId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${p.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) throw new Error(`WhatsApp publish failed: ${res.status} - ${await res.text()}`);
  const data = (await res.json()) as { messages: Array<{ id: string }> };
  return { postId: data.messages[0]?.id ?? "unknown" };
}

async function publishToSlack(p: PublishPayload): Promise<PublishResult> {
  // accountId = Slack channel ID; accessToken = bot OAuth token
  if (!p.accountId) throw new Error("Slack requires accountId (channel ID)");

  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${p.accessToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ channel: p.accountId, text: p.content }),
  });

  if (!res.ok) throw new Error(`Slack publish failed: ${res.status}`);
  const data = (await res.json()) as { ok: boolean; ts: string; error?: string };
  if (!data.ok) throw new Error(`Slack publish error: ${data.error}`);
  return { postId: data.ts };
}

async function publishToReddit(p: PublishPayload): Promise<PublishResult> {
  const subreddit = p.subreddit ?? p.accountId;
  if (!subreddit) throw new Error("Reddit requires subreddit name via accountId or subreddit field");

  // Split primaryText into title (first line) + body (rest)
  const lines = p.content.split("\n\n");
  const title = lines[0]?.slice(0, 300) ?? p.content.slice(0, 300);
  const text = lines.slice(1).join("\n\n");

  const res = await fetch("https://oauth.reddit.com/api/submit", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${p.accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": p.userAgent ?? "Anthyx/1.0",
    },
    body: new URLSearchParams({
      sr: subreddit,
      kind: "self",
      title,
      text,
      resubmit: "true",
    }).toString(),
  });

  if (!res.ok) throw new Error(`Reddit publish failed: ${res.status}`);
  const data = (await res.json()) as { json: { data: { id: string; url: string } } };
  return { postId: data.json.data.id, url: data.json.data.url };
}

async function publishToThreads(p: PublishPayload): Promise<PublishResult> {
  if (!p.accountId) throw new Error("Threads requires accountId");

  // Threads uses the same Graph API as Instagram but different endpoint
  const containerRes = await fetch(`https://graph.threads.net/v1.0/${p.accountId}/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: p.content,
      media_type: p.mediaUrls?.[0] ? "IMAGE" : "TEXT",
      ...(p.mediaUrls?.[0] ? { image_url: p.mediaUrls[0] } : {}),
      access_token: p.accessToken,
    }),
  });

  if (!containerRes.ok) throw new Error(`Threads container failed: ${containerRes.status}`);
  const container = (await containerRes.json()) as { id: string };

  const publishRes = await fetch(`https://graph.threads.net/v1.0/${p.accountId}/threads_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: container.id, access_token: p.accessToken }),
  });

  if (!publishRes.ok) throw new Error(`Threads publish failed: ${publishRes.status}`);
  const pub = (await publishRes.json()) as { id: string };

  // Post hashtags as first comment
  if (p.hashtags?.length && pub.id) {
    const commentText = p.hashtags.map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" ");
    await fetch(`https://graph.threads.net/v1.0/${pub.id}/replies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: commentText, access_token: p.accessToken }),
    }).catch(() => {});
  }

  return { postId: pub.id };
}

async function publishToBluesky(p: PublishPayload): Promise<PublishResult> {
  // Bluesky AT Protocol
  const did = p.blueskyDid ?? p.accountId;
  if (!did) throw new Error("Bluesky requires DID via blueskyDid or accountId");

  const res = await fetch("https://bsky.social/xrpc/com.atproto.repo.createRecord", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${p.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      repo: did,
      collection: "app.bsky.feed.post",
      record: {
        $type: "app.bsky.feed.post",
        text: p.content,
        createdAt: new Date().toISOString(),
      },
    }),
  });

  if (!res.ok) throw new Error(`Bluesky publish failed: ${res.status} - ${await res.text()}`);
  const data = (await res.json()) as { cid: string; uri: string };
  const postId = data.uri.split("/").pop() ?? data.cid;
  return { postId, url: data.uri };
}

async function publishToMastodon(p: PublishPayload): Promise<PublishResult> {
  const instance = p.mastodonInstance ?? "mastodon.social";

  const res = await fetch(`https://${instance}/api/v1/statuses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${p.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      status: p.content,
      visibility: "public",
    }),
  });

  if (!res.ok) throw new Error(`Mastodon publish failed: ${res.status} - ${await res.text()}`);
  const data = (await res.json()) as { id: string; url: string };
  return { postId: data.id, url: data.url };
}

async function publishToYouTube(p: PublishPayload): Promise<PublishResult> {
  // YouTube Data API v3 — post a comment on a video or update video description
  // accountId = YouTube channel ID for uploading; here we use it for comment posting
  // Full video upload requires multipart, which is outside the scope of caption-only posting.
  // This posts a comment to the channel's community tab or a specified video.
  if (!p.accountId) throw new Error("YouTube requires accountId (channel ID or video ID)");

  const res = await fetch("https://www.googleapis.com/youtube/v3/commentThreads?part=snippet", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${p.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      snippet: {
        videoId: p.accountId,
        topLevelComment: {
          snippet: { textOriginal: p.content },
        },
      },
    }),
  });

  if (!res.ok) throw new Error(`YouTube publish failed: ${res.status} - ${await res.text()}`);
  const data = (await res.json()) as { id: string };
  return { postId: data.id };
}

async function publishToPinterest(p: PublishPayload): Promise<PublishResult> {
  if (!p.pinterestBoardId) throw new Error("Pinterest requires board ID in platformConfig");

  // Use first line of content as pin title (100 char max), rest as description
  const lines = p.content.split("\n");
  const title = (lines[0] ?? "").slice(0, 100);
  const description = p.content.slice(0, 500);

  const body: Record<string, unknown> = {
    board_id: p.pinterestBoardId,
    title,
    description,
  };

  if (p.mediaUrls?.[0]) {
    body["media_source"] = { source_type: "image_url", url: p.mediaUrls[0] };
  }

  const res = await fetch("https://api.pinterest.com/v5/pins", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${p.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Pinterest publish failed: ${res.status} - ${await res.text()}`);
  const data = (await res.json()) as { id: string };
  return { postId: data.id };
}

async function publishToEmail(p: PublishPayload): Promise<PublishResult> {
  if (!p.emailTo?.length) throw new Error("Email requires recipient list");

  // Read server-level credentials from process.env at call time (same pattern as publishToTelegram
  // reading TELEGRAM_BOT_TOKEN). Operator sets MAIL_MAILER + credentials in .env; users only
  // configure their recipient list.
  const mailer = process.env["MAIL_MAILER"] ?? "smtp";
  const fromAddress = process.env["MAIL_FROM_ADDRESS"] ?? "";
  const fromName = process.env["MAIL_FROM_NAME"] ?? "";
  const from = fromName ? `${fromName} <${fromAddress}>` : fromAddress;

  if (!fromAddress) throw new Error("Server email not configured — set MAIL_FROM_ADDRESS in environment");

  // First line → subject (strip optional "Subject: " prefix), rest → HTML body
  const newlineIdx = p.content.indexOf("\n");
  const subject = (newlineIdx > -1 ? p.content.slice(0, newlineIdx) : p.content.slice(0, 100))
    .replace(/^Subject:\s*/i, "")
    .trim();
  const htmlBody = newlineIdx > -1 ? p.content.slice(newlineIdx + 1).trim() : p.content;

  if (mailer === "smtp") {
    const host = process.env["MAIL_HOST"] ?? "";
    const port = parseInt(process.env["MAIL_PORT"] ?? "587", 10);
    const username = process.env["MAIL_USERNAME"] ?? "";
    const password = process.env["MAIL_PASSWORD"] ?? "";
    const encryption = process.env["MAIL_ENCRYPTION"] ?? "tls";
    if (!host || !username || !password) throw new Error("SMTP not configured — set MAIL_HOST, MAIL_USERNAME, MAIL_PASSWORD");

    const transport = nodemailer.createTransport({
      host, port,
      secure: encryption === "ssl",
      requireTLS: encryption === "tls",
      auth: { user: username, pass: password },
    });
    // Send individually — each recipient gets a separate email, no address leakage
    const results = await Promise.allSettled(
      p.emailTo.map((to) => transport.sendMail({ from, to, subject, html: htmlBody })),
    );
    transport.close();
    const firstOk = results.find((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof transport.sendMail>>> => r.status === "fulfilled");
    return { postId: firstOk?.value.messageId ?? `smtp_${Date.now()}` };
  }

  if (mailer === "sendgrid") {
    const apiKey = process.env["SENDGRID_API_KEY"] ?? "";
    if (!apiKey) throw new Error("SendGrid not configured — set SENDGRID_API_KEY");
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: p.emailTo.map((email) => ({ to: [{ email }] })),
        from: { email: fromAddress, ...(fromName ? { name: fromName } : {}) },
        subject,
        content: [{ type: "text/html", value: htmlBody }],
      }),
    });
    if (!res.ok) throw new Error(`SendGrid send failed: ${res.status} - ${await res.text()}`);
    return { postId: `sg_${Date.now()}` };
  }

  if (mailer === "mailgun") {
    const apiKey = process.env["MAILGUN_API_KEY"] ?? "";
    const domain = process.env["MAILGUN_DOMAIN"] ?? "";
    if (!apiKey || !domain) throw new Error("Mailgun not configured — set MAILGUN_API_KEY and MAILGUN_DOMAIN");
    const results = await Promise.allSettled(
      p.emailTo.map((to) => {
        const body = new URLSearchParams({ from, to, subject, html: htmlBody });
        return fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
          method: "POST",
          headers: { Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}` },
          body,
        });
      }),
    );
    const firstOk = results.find((r): r is PromiseFulfilledResult<Response> => r.status === "fulfilled" && r.value.ok);
    const firstId = firstOk ? ((await firstOk.value.json()) as { id?: string }).id ?? `mg_${Date.now()}` : `mg_${Date.now()}`;
    return { postId: firstId };
  }

  throw new Error(`Unsupported MAIL_MAILER: "${mailer}". Supported: smtp, sendgrid, mailgun`);
}
