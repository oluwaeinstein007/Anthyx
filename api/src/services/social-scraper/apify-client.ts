const APIFY_BASE = "https://api.apify.com/v2";

export interface SocialEngagementData {
  platform: "instagram" | "linkedin";
  handle: string;
  followersCount: number;
  avgLikesPerPost: number;
  avgCommentsPerPost: number;
  engagementRate: number; // e.g. 2.4 means 2.4%
  postingFrequency: string; // e.g. "~3.5 posts/week"
  followerGrowthTrend: string | null;
}

async function runActorSync<T>(
  actorId: string,
  input: unknown,
  timeoutSecs: number,
): Promise<T[] | null> {
  const token = process.env["APIFY_API_TOKEN"];
  if (!token) return null;

  try {
    const url =
      `${APIFY_BASE}/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items` +
      `?token=${token}&timeout=${timeoutSecs}&memory=256`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout((timeoutSecs + 15) * 1000),
    });

    if (!res.ok) return null;
    return (await res.json()) as T[];
  } catch {
    return null;
  }
}

export async function scrapeInstagramProfile(
  rawHandle: string,
): Promise<SocialEngagementData | null> {
  const handle = rawHandle.replace(/^@/, "");

  const items = await runActorSync<Record<string, unknown>>(
    "apify~instagram-profile-scraper",
    { usernames: [handle], resultsLimit: 20 },
    90,
  );

  if (!items?.length) return null;

  const profile = items[0]!;
  const recentPosts = (profile["latestPosts"] ?? []) as Array<{
    likesCount?: number;
    commentsCount?: number;
    timestamp?: string;
  }>;

  const avgLikesPerPost =
    recentPosts.length > 0
      ? Math.round(
          recentPosts.reduce((s, p) => s + (p.likesCount ?? 0), 0) / recentPosts.length,
        )
      : 0;

  const avgCommentsPerPost =
    recentPosts.length > 0
      ? Math.round(
          recentPosts.reduce((s, p) => s + (p.commentsCount ?? 0), 0) / recentPosts.length,
        )
      : 0;

  const followersCount = (profile["followersCount"] as number | undefined) ?? 0;
  const engagementRate =
    followersCount > 0
      ? parseFloat((((avgLikesPerPost + avgCommentsPerPost) / followersCount) * 100).toFixed(2))
      : 0;

  let postingFrequency = "unknown";
  const timestamps = recentPosts
    .map((p) => (p.timestamp ? new Date(p.timestamp).getTime() : null))
    .filter((t): t is number => t !== null)
    .sort((a, b) => b - a);

  if (timestamps.length >= 2) {
    const spanDays = (timestamps[0]! - timestamps[timestamps.length - 1]!) / 86_400_000;
    if (spanDays > 0) {
      const perWeek = parseFloat(((timestamps.length / spanDays) * 7).toFixed(1));
      postingFrequency = `~${perWeek} posts/week`;
    }
  }

  return {
    platform: "instagram",
    handle,
    followersCount,
    avgLikesPerPost,
    avgCommentsPerPost,
    engagementRate,
    postingFrequency,
    followerGrowthTrend: null,
  };
}

export async function scrapeLinkedInCompany(
  rawSlug: string,
): Promise<SocialEngagementData | null> {
  const url = rawSlug.startsWith("http")
    ? rawSlug
    : `https://www.linkedin.com/company/${rawSlug}/`;

  const items = await runActorSync<Record<string, unknown>>(
    "apify~linkedin-company-scraper",
    { startUrls: [{ url }], maxConcurrency: 1 },
    90,
  );

  if (!items?.length) return null;

  const company = items[0]!;
  const followersCount = ((company["followersCount"] ?? company["followers"] ?? 0) as number);

  return {
    platform: "linkedin",
    handle: rawSlug,
    followersCount,
    avgLikesPerPost: 0,
    avgCommentsPerPost: 0,
    engagementRate: 0,
    postingFrequency: "unknown",
    followerGrowthTrend: null,
  };
}
