import { Worker, Queue } from "bullmq";
import { eq, and } from "drizzle-orm";
import { db } from "../db/client";
import { rssFeeds, feedItems } from "../db/schema";
import { redisConnection } from "../queue/client";

const feedsQueue = new Queue("anthyx-feeds", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "fixed", delay: 30_000 },
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 86400 },
  },
});

async function scheduleFeedsJob() {
  const existing = await feedsQueue.getRepeatableJobs();
  if (existing.some((j) => j.name === "ingest-all-feeds")) return;
  await feedsQueue.add("ingest-all-feeds", {}, { repeat: { every: 60 * 60 * 1000 } });
}

scheduleFeedsJob().catch((err) =>
  console.error("[FeedsWorker] Failed to schedule repeatable job:", err),
);

const worker = new Worker(
  "anthyx-feeds",
  async () => {
    const feeds = await db.query.rssFeeds.findMany({
      where: eq(rssFeeds.isActive, true),
    });

    console.log(`[FeedsWorker] Ingesting ${feeds.length} RSS feeds`);

    await Promise.allSettled(
      feeds.map(async (feed) => {
        try {
          const res = await fetch(feed.feedUrl, {
            signal: AbortSignal.timeout(15_000),
            headers: { "User-Agent": "Anthyx-FeedBot/1.0" },
          });
          if (!res.ok) {
            console.error(`[FeedsWorker] ${feed.feedUrl} returned ${res.status}`);
            return;
          }

          const xml = await res.text();

          const itemPattern = /<item[^>]*>([\s\S]*?)<\/item>|<entry[^>]*>([\s\S]*?)<\/entry>/gi;
          const titlePattern = /<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i;
          const linkPattern = /<link[^>]*href="([^"]+)"|<link[^>]*>(https?:\/\/[^<]+)<\/link>/i;
          const pubDatePattern =
            /<pubDate[^>]*>([\s\S]*?)<\/pubDate>|<published[^>]*>([\s\S]*?)<\/published>|<updated[^>]*>([\s\S]*?)<\/updated>/i;
          const descPattern =
            /<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>|<summary[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/summary>/i;

          let match: RegExpExecArray | null;
          const parsed: Array<{ title: string; url: string; publishedAt: Date; summary: string }> = [];

          while ((match = itemPattern.exec(xml)) !== null) {
            const block = match[1] ?? match[2] ?? "";
            const titleMatch = titlePattern.exec(block);
            const linkMatch = linkPattern.exec(block);
            const pubMatch = pubDatePattern.exec(block);
            const descMatch = descPattern.exec(block);

            const title = (titleMatch?.[1] ?? "").trim();
            const url = (linkMatch?.[1] ?? linkMatch?.[2] ?? "").trim();
            const rawDate = pubMatch?.[1] ?? pubMatch?.[2] ?? pubMatch?.[3];
            const publishedAt = rawDate ? new Date(rawDate) : new Date();
            const rawDesc = (descMatch?.[1] ?? descMatch?.[2] ?? "").replace(/<[^>]+>/g, "").trim();
            const summary = rawDesc.slice(0, 500);

            if (!title || !url) continue;
            parsed.push({ title, url, publishedAt, summary });
          }

          for (const item of parsed.slice(0, 50)) {
            const existing = await db.query.feedItems.findFirst({
              where: and(eq(feedItems.rssFeedId, feed.id), eq(feedItems.url, item.url)),
            });
            if (existing) continue;

            await db.insert(feedItems).values({
              rssFeedId: feed.id,
              organizationId: feed.organizationId,
              title: item.title,
              url: item.url,
              summary: item.summary || null,
              publishedAt: item.publishedAt,
            });
          }

          await db
            .update(rssFeeds)
            .set({ lastFetchedAt: new Date() })
            .where(eq(rssFeeds.id, feed.id));
        } catch (err) {
          console.error(`[FeedsWorker] Error ingesting ${feed.feedUrl}:`, err);
        }
      }),
    );
  },
  { connection: redisConnection, concurrency: 5 },
);

worker.on("error", (err) => console.error("[FeedsWorker] Error:", err));

export { worker as feedsWorker };
