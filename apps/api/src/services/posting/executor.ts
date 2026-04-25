import type { Platform } from "@anthyx/types";
import { buildProxiedAgent, getRandomUserAgent } from "./proxy-router";
import { publishPost } from "./social-mcp";
import { formatPostForPlatform } from "./formatter";

export interface PublishParams {
  platform: Platform;
  organizationId: string;
  content: string;
  hashtags: string[];
  mediaUrls?: string[];
  accessToken: string;
  accountId?: string;
  platformConfig?: Record<string, unknown>;
}

export interface PublishResult {
  postId: string;
  url?: string;
  truncated?: boolean;
}

export async function publishToplatform(params: PublishParams): Promise<PublishResult> {
  const proxyAgent = buildProxiedAgent(params.organizationId);
  const userAgent = getRandomUserAgent();
  const cfg = params.platformConfig ?? {};

  // Format content and hashtags for the target platform before publishing
  const formatted = formatPostForPlatform(params.platform, params.content, params.hashtags);

  const result = await publishPost({
    platform: params.platform,
    accessToken: params.accessToken,
    content: formatted.primaryText,
    hashtags: formatted.firstComment ? [] : (formatted.hashtags ?? params.hashtags),
    mediaUrls: params.mediaUrls,
    accountId: params.accountId,
    proxyAgent: proxyAgent ?? undefined,
    userAgent,
    // Mastodon
    mastodonInstance: cfg["instance"] as string | undefined,
    // Bluesky
    blueskyDid: (cfg["did"] as string | undefined) ?? params.accountId,
    // Pinterest
    pinterestBoardId: cfg["boardId"] as string | undefined,
    // Email — credentials are server-level env vars (MAIL_MAILER etc.), only recipients are per-org
    emailTo: cfg["recipients"] as string[] | undefined,
  });

  return { ...result, truncated: formatted.truncated };
}
