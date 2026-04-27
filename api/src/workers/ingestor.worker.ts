import { Worker, type Job } from "bullmq";
import { eq, sql } from "drizzle-orm";
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

export type IngestProgress = {
  step: "parsing" | "extracting" | "embedding" | "done" | "failed";
  message: string;
};

const worker = new Worker<IngestJobData>(
  "anthyx-ingestor",
  async (job: Job<IngestJobData>) => {
    const { brandId, organizationId, sourceType, filePath, url, rawText, sourceName } = job.data;

    console.log(`[IngestorWorker] Processing ingestion for brand ${brandId}, type: ${sourceType}`);

    await db
      .update(brandProfiles)
      .set({ ingestStatus: "processing", updatedAt: new Date() })
      .where(eq(brandProfiles.id, brandId));

    // Step 1: Parse
    await job.updateProgress({ step: "parsing", message: "Parsing document…" } satisfies IngestProgress);

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

    // Step 2: Extract
    await job.updateProgress({ step: "extracting", message: "Extracting brand identity…" } satisfies IngestProgress);
    const extraction = await extractBrandData(text);

    // Step 3: Embed
    await job.updateProgress({ step: "embedding", message: "Embedding into knowledge base…" } satisfies IngestProgress);
    await ingestBrandDocument(text, brandId, organizationId, sourceName ?? "document", extraction);

    // Persist extracted data + append to ingest_history
    const historyEntry = {
      sourceType,
      sourceName: sourceName ?? "document",
      ingestedAt: new Date().toISOString(),
      summary: extraction.valueProposition ?? `Extracted ${extraction.toneDescriptors?.length ?? 0} tone descriptors`,
    };

    await db
      .update(brandProfiles)
      .set({
        ...(extraction.industry ? { industry: extraction.industry } : {}),
        voiceTraits: extraction.voiceTraits,
        toneDescriptors: extraction.toneDescriptors,
        primaryColors: extraction.primaryColors,
        secondaryColors: extraction.secondaryColors,
        typography: extraction.typography,
        brandContext: {
          brandStatements: extraction.brandStatements,
          audienceNotes: extraction.audienceNotes,
          productsServices: extraction.productsServices ?? [],
          valueProposition: extraction.valueProposition ?? null,
          targetMarket: extraction.targetMarket ?? null,
          contentPillars: extraction.contentPillars ?? [],
          competitors: extraction.competitors ?? [],
        },
        qdrantCollectionId: `brand_${brandId}`,
        ingestStatus: "done",
        ingestHistory: sql`COALESCE(ingest_history, '[]'::jsonb) || ${JSON.stringify([historyEntry])}::jsonb`,
        updatedAt: new Date(),
      })
      .where(eq(brandProfiles.id, brandId));

    await job.updateProgress({ step: "done", message: "Ingestion complete" } satisfies IngestProgress);

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
