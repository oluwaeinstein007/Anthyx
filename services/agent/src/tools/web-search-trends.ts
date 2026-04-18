export async function webSearchTrends(args: {
  industry: string;
  keywords: string[];
  timeframe: "7d" | "30d";
}): Promise<string> {
  const query = `${args.industry} ${args.keywords.join(" ")} trends ${args.timeframe === "7d" ? "this week" : "this month"}`;
  const apiKey = process.env["SEARCH_API_KEY"];

  if (apiKey) {
    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey, query, search_depth: "basic", max_results: 5 }),
      });
      if (res.ok) {
        const data = (await res.json()) as { results: Array<{ title: string; snippet: string; url: string }> };
        return JSON.stringify({
          trends: data.results.map((r) => ({ title: r.title, summary: r.snippet, url: r.url, relevanceScore: 0.9 })),
          relevantTopics: args.keywords,
          query,
        });
      }
    } catch {
      // fall through to stub
    }
  }

  return JSON.stringify({
    trends: [{ title: `${args.industry} Industry Update`, summary: `Recent developments in ${args.industry} related to ${args.keywords.join(", ")}.`, url: null, relevanceScore: 0.7 }],
    relevantTopics: args.keywords,
    query,
    note: "Set SEARCH_API_KEY (Tavily) for live trend data",
  });
}
