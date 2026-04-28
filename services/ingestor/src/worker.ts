import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { eq, and, sql } from "drizzle-orm";
import type { IngestBrandPayload } from "@anthyx/queue-contracts";
import { db } from "./db.js";
import { brandProfiles, competitors } from "./schema.js";
import { parseSource } from "./parser.js";
import { extractBrandData } from "./extractor.js";
import { ingestBrandDocument } from "./embedder.js";

const QUEUE_NAME = "anthyx-ingestor";
const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:6379";

const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

const worker = new Worker<IngestBrandPayload>(
  QUEUE_NAME,
  async (job) => {
    const { brandId, organizationId, sourceType, filePath, url, rawText, sourceName } = job.data;

    console.log(`[ingestor] Processing job ${job.id} for brand ${brandId}`);

    await db
      .update(brandProfiles)
      .set({ ingestStatus: "processing", updatedAt: new Date() })
      .where(eq(brandProfiles.id, brandId));

    const parsed = await parseSource({ type: sourceType, path: filePath, url, rawText });
    const extraction = await extractBrandData(parsed.text);

    await ingestBrandDocument(
      parsed.text,
      brandId,
      organizationId,
      sourceName ?? parsed.sourceName,
      extraction,
    );

    // Auto-add competitors discovered during extraction (skip duplicates by name)
    if (extraction.competitors && extraction.competitors.length > 0) {
      for (const competitorName of extraction.competitors) {
        const existing = await db.query.competitors.findFirst({
          where: and(
            eq(competitors.brandProfileId, brandId),
            eq(competitors.name, competitorName),
          ),
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

    const historyEntry = {
      sourceType,
      sourceName: sourceName ?? parsed.sourceName,
      ingestedAt: new Date().toISOString(),
      summary: extraction.valueProposition ?? `Extracted ${extraction.toneDescriptors?.length ?? 0} tone descriptors`,
    };

    await db
      .update(brandProfiles)
      .set({
        ...(extraction.industry ? { industry: extraction.industry } : {}),
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
        ingestStatus: "done",
        ingestHistory: sql`COALESCE(ingest_history, '[]'::jsonb) || ${JSON.stringify([historyEntry])}::jsonb`,
        updatedAt: new Date(),
      })
      .where(eq(brandProfiles.id, brandId));

    console.log(`[ingestor] Completed job ${job.id} for brand ${brandId}`);
  },
  {
    connection,
    concurrency: parseInt(process.env["INGESTOR_CONCURRENCY"] ?? "3"),
  },
);

worker.on("failed", async (job, err) => {
  console.error(`[ingestor] Job ${job?.id} failed:`, err.message);
  if (job) {
    await db
      .update(brandProfiles)
      .set({ ingestStatus: "failed", updatedAt: new Date() })
      .where(eq(brandProfiles.id, job.data.brandId));
  }
});

console.log(`[ingestor] Worker listening on queue: ${QUEUE_NAME}`);
