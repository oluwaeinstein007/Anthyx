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

  // Build email "from" string from stored config
  const emailFromAddress = cfg["fromAddress"] as string | undefined;
  const emailFromName = cfg["fromName"] as string | undefined;
  const emailFrom = emailFromName && emailFromAddress
    ? `${emailFromName} <${emailFromAddress}>`
    : (emailFromAddress ?? undefined);

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
    // Email — per-org credentials from DB
    emailTo: cfg["recipients"] as string[] | undefined,
    emailMailer: cfg["mailer"] as "smtp" | "sendgrid" | "mailgun" | undefined,
    emailFrom,
    emailSmtpHost: cfg["host"] as string | undefined,
    emailSmtpPort: cfg["port"] as number | undefined,
    emailSmtpUsername: cfg["username"] as string | undefined,
    emailSmtpEncryption: cfg["encryption"] as string | undefined,
    emailMailgunDomain: cfg["domain"] as string | undefined,
  });

  return { ...result, truncated: formatted.truncated };
}
