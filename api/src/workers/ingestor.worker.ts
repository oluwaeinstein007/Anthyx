import { Worker, type Job } from "bullmq";
import { eq, sql, and } from "drizzle-orm";
import { db } from "../db/client";
import { brandProfiles, competitors } from "../db/schema";
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

    // Auto-add competitors discovered during extraction (skip duplicates by name)
    if (extraction.competitors && extraction.competitors.length > 0) {
      for (const competitorName of extraction.competitors) {
        const existing = await db.query.competitors.findFirst({
          where: and(eq(competitors.brandProfileId, brandId), eq(competitors.name, competitorName)),
        });
        if (!existing) {
          await db.insert(competitors).values({
            organizationId,
            brandProfileId: brandId,
            name: competitorName,
            tier: "direct",
            status: "new",
            notes: "Auto-discovered during brand ingestion",
          });
        }
      }
    }

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
        // Only overwrite fields that have a real extracted value — never clobber manually entered data with null
        ...(extraction.tagline ? { tagline: extraction.tagline } : {}),
        ...(extraction.websiteUrl ? { websiteUrl: extraction.websiteUrl } : {}),
        ...(extraction.brandEmail ? { brandEmail: extraction.brandEmail } : {}),
        ...(extraction.brandStage ? { brandStage: extraction.brandStage } : {}),
        ...(extraction.missionStatement ? { missionStatement: extraction.missionStatement } : {}),
        ...(extraction.visionStatement ? { visionStatement: extraction.visionStatement } : {}),
        ...(extraction.originStory ? { originStory: extraction.originStory } : {}),
        ...((extraction.coreValues?.length ?? 0) > 0 ? { coreValues: extraction.coreValues } : {}),
        ...((extraction.voiceExamples?.length ?? 0) > 0 ? { voiceExamples: extraction.voiceExamples } : {}),
        ...((extraction.contentDos?.length ?? 0) > 0 ? { contentDos: extraction.contentDos } : {}),
        ...((extraction.bannedWords?.length ?? 0) > 0 ? { bannedWords: extraction.bannedWords } : {}),
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
