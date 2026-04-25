import type { Platform } from "@anthyx/types";

export interface RefreshedTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number; // seconds
}

type PlatformRefresher = (refreshToken: string) => Promise<RefreshedTokens>;

async function refreshTwitterToken(refreshToken: string): Promise<RefreshedTokens> {
  const clientId = process.env["TWITTER_CLIENT_ID"]!;
  const clientSecret = process.env["TWITTER_CLIENT_SECRET"]!;
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error(`Twitter token refresh failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in ?? 7200,
  };
}

async function refreshInstagramToken(refreshToken: string): Promise<RefreshedTokens> {
  const appId = process.env["INSTAGRAM_APP_ID"]!;
  const appSecret = process.env["INSTAGRAM_APP_SECRET"]!;

  const url = new URL("https://graph.instagram.com/refresh_access_token");
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", refreshToken);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Instagram token refresh failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in ?? 5183944,
  };
}

async function refreshLinkedInToken(refreshToken: string): Promise<RefreshedTokens> {
  const response = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: process.env["LINKEDIN_CLIENT_ID"]!,
      client_secret: process.env["LINKEDIN_CLIENT_SECRET"]!,
    }),
  });

  if (!response.ok) {
    throw new Error(`LinkedIn token refresh failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in ?? 5184000,
  };
}

// Telegram uses bot tokens — they don't expire or need refreshing
async function refreshTelegramToken(token: string): Promise<RefreshedTokens> {
  return { accessToken: token, expiresIn: 99999999 };
}

export const PLATFORM_REFRESHERS: Partial<Record<Platform, PlatformRefresher>> = {
  x: refreshTwitterToken,
  instagram: refreshInstagramToken,
  linkedin: refreshLinkedInToken,
  telegram: refreshTelegramToken,
};
