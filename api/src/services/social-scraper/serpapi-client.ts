export interface CompetitorMentionData {
  competitorName: string;
  recentMentionCount: number;
  recentHeadlines: string[];
}

export async function fetchCompetitorMentions(
  competitorName: string,
): Promise<CompetitorMentionData | null> {
  const key = process.env["SERPAPI_KEY"];
  if (!key) return null;

  try {
    const params = new URLSearchParams({
      engine: "google_news",
      q: competitorName,
      api_key: key,
      num: "10",
    });

    const res = await fetch(`https://serpapi.com/search.json?${params}`, {
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      news_results?: Array<{ title?: string }>;
    };

    const results = data.news_results ?? [];
    return {
      competitorName,
      recentMentionCount: results.length,
      recentHeadlines: results
        .map((r) => r.title ?? "")
        .filter(Boolean)
        .slice(0, 5),
    };
  } catch {
    return null;
  }
}
