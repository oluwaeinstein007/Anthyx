import { Worker, type Job } from "bullmq";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { brandProfiles } from "../db/schema";
import { redisConnection } from "../queue/client";
import { parsePdf, parseUrl, parseMarkdown } from "../services/brand-ingestion/parser";
import { extractBrandData } from "../services/brand-ingestion/extractor";
import { ingestBrandDocument } from "../services/brand-ingestion/embedder";

interface IngestJobData {
  brandId: string;
  organizationId: string;
  sourceType: "pdf" | "markdown" | "url" | "plaintext";
  filePath?: string;
  url?: string;
  rawText?: string;
  sourceName?: string;
}

const worker = new Worker<IngestJobData>(
  "anthyx-ingestor",
  async (job: Job<IngestJobData>) => {
    const { brandId, organizationId, sourceType, filePath, url, rawText, sourceName } = job.data;

    console.log(`[IngestorWorker] Processing ingestion for brand ${brandId}, type: ${sourceType}`);

    await db
      .update(brandProfiles)
      .set({ ingestStatus: "processing", updatedAt: new Date() })
      .where(eq(brandProfiles.id, brandId));

    let text: string;

    if (sourceType === "pdf" && filePath) {
      const parsed = await parsePdf(filePath);
      text = parsed.text;
    } else if (sourceType === "markdown" && filePath) {
      const parsed = await parseMarkdown(filePath);
      text = parsed.text;
    } else if (sourceType === "url" && url) {
      const parsed = await parseUrl(url);
      text = parsed.text;
    } else if (sourceType === "plaintext" && rawText) {
      text = rawText;
    } else {
      throw new Error("Invalid ingest job: missing source content");
    }

    const extraction = await extractBrandData(text);

    await db
      .update(brandProfiles)
      .set({
        ...(extraction.industry ? { industry: extraction.industry } : {}),
        voiceTraits: extraction.voiceTraits,
        toneDescriptors: extraction.toneDescriptors,
        primaryColors: extraction.primaryColors,
        secondaryColors: extraction.secondaryColors,
        typography: extraction.typography,
        qdrantCollectionId: `brand_${brandId}`,
        ingestStatus: "done",
        updatedAt: new Date(),
      })
      .where(eq(brandProfiles.id, brandId));

    await ingestBrandDocument(text, brandId, organizationId, sourceName ?? "document", extraction);

    console.log(`[IngestorWorker] Ingestion complete for brand ${brandId}`);
  },
  {
    connection: redisConnection,
    concurrency: 2,
  },
);

worker.on("failed", async (job, err) => {
  if (job) {
    await db
      .update(brandProfiles)
      .set({ ingestStatus: "failed", updatedAt: new Date() })
      .where(eq(brandProfiles.id, job.data.brandId));
  }
  console.error(`[IngestorWorker] Job ${job?.id} failed:`, err);
});

export { worker as ingestorWorker };
