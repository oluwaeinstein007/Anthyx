import type { Platform } from "@anthyx/types";
import { buildProxiedAgent, getRandomUserAgent } from "./proxy-router";
import { publishPost } from "./social-mcp";

export interface PublishParams {
  platform: Platform;
  organizationId: string;
  content: string;
  hashtags: string[];
  mediaUrls?: string[];
  accessToken: string;
  accountId?: string;
}

export interface PublishResult {
  postId: string;
  url?: string;
}

export async function publishToplatform(params: PublishParams): Promise<PublishResult> {
  const proxyAgent = buildProxiedAgent(params.organizationId);
  const userAgent = getRandomUserAgent();

  return publishPost({
    platform: params.platform,
    accessToken: params.accessToken,
    content: params.content,
    hashtags: params.hashtags,
    mediaUrls: params.mediaUrls,
    accountId: params.accountId,
    proxyAgent: proxyAgent ?? undefined,
    userAgent,
  });
}
