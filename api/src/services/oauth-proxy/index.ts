import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { socialAccounts } from "../../db/schema";
import { encryptToken, decryptToken } from "./crypto";
import { PLATFORM_REFRESHERS } from "./refreshers";
import { logAgentAction } from "../agent/logger";
import type { Platform } from "@anthyx/types";

export class OAuthProxyService {
  private static instance: OAuthProxyService;

  static getInstance(): OAuthProxyService {
    if (!OAuthProxyService.instance) {
      OAuthProxyService.instance = new OAuthProxyService();
    }
    return OAuthProxyService.instance;
  }

  async getValidToken(socialAccountId: string): Promise<string> {
    const account = await db.query.socialAccounts.findFirst({
      where: eq(socialAccounts.id, socialAccountId),
    });

    if (!account) throw new Error(`Social account ${socialAccountId} not found`);
    if (!account.accessToken) throw new Error(`No access token for account ${socialAccountId}`);

    // Refresh if expiring within 5 minutes
    const expiresAt = account.tokenExpiresAt?.getTime() ?? 0;
    const needsRefresh = expiresAt > 0 && expiresAt - Date.now() < 5 * 60 * 1000;

    if (needsRefresh && account.refreshToken) {
      return this.refreshToken(account);
    }

    return decryptToken(account.accessToken);
  }

  private async refreshToken(account: typeof socialAccounts.$inferSelect): Promise<string> {
    const platform = account.platform as Platform;
    const refresher = PLATFORM_REFRESHERS[platform];

    if (!refresher) {
      // Token can't be refreshed — return current
      return decryptToken(account.accessToken!);
    }

    const decryptedRefreshToken = decryptToken(account.refreshToken!);
    const newTokens = await refresher(decryptedRefreshToken);

    await db
      .update(socialAccounts)
      .set({
        accessToken: encryptToken(newTokens.accessToken),
        refreshToken: newTokens.refreshToken
          ? encryptToken(newTokens.refreshToken)
          : account.refreshToken,
        tokenExpiresAt: new Date(Date.now() + newTokens.expiresIn * 1000),
        updatedAt: new Date(),
      })
      .where(eq(socialAccounts.id, account.id));

    await logAgentAction(account.organizationId, account.id, null, "token_refreshed", {
      platform,
    });

    return newTokens.accessToken;
  }

  storeTokens(
    socialAccountId: string,
    tokens: { accessToken: string; refreshToken?: string; expiresIn?: number },
  ) {
    return db
      .update(socialAccounts)
      .set({
        accessToken: encryptToken(tokens.accessToken),
        refreshToken: tokens.refreshToken ? encryptToken(tokens.refreshToken) : undefined,
        tokenExpiresAt: tokens.expiresIn
          ? new Date(Date.now() + tokens.expiresIn * 1000)
          : undefined,
        updatedAt: new Date(),
      })
      .where(eq(socialAccounts.id, socialAccountId));
  }
}

export const oauthProxy = OAuthProxyService.getInstance();
