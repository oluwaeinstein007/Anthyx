/**
 * Unified social publishing adapter.
 * Single point of import for all platform posting — no other file should
 * call platform APIs directly for publishing.
 *
 * When your social-mcp npm package (v1.3.3+) is ready, replace the
 * per-platform implementations below with:
 *   import { SocialMCP } from "social-mcp";
 *   const client = new SocialMCP({ ... });
 */

import type { Platform } from "@anthyx/types";
import type { Agent } from "https-proxy-agent";

export interface PublishPayload {
  platform: Platform;
  accessToken: string;
  content: string;
  hashtags?: string[];
  mediaUrls?: string[];
  accountId?: string;
  proxyAgent?: Agent;
  userAgent?: string;
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
    default:
      throw new Error(`Platform ${payload.platform} not yet supported`);
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
    default:
      return { likes: 0, reposts: 0, comments: 0, impressions: 0, clicks: 0, raw: {} };
  }
}

async function publishToX(p: PublishPayload): Promise<PublishResult> {
  const fullText = [p.content, ...(p.hashtags ?? []).map((t) => `#${t}`)].join(" ").slice(0, 280);
  const body: Record<string, unknown> = { text: fullText };
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
  return { postId: data.data.id };
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
  return { postId: pub.id };
}

async function publishToLinkedIn(p: PublishPayload): Promise<PublishResult> {
  const hashtagText = (p.hashtags ?? []).map((t) => `#${t}`).join(" ");
  const fullContent = `${p.content}\n\n${hashtagText}`.trim();

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
          shareCommentary: { text: fullContent },
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
