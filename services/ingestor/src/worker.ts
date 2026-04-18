import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { eq } from "drizzle-orm";
import type { IngestBrandPayload } from "@anthyx/queue-contracts";
import { db } from "./db.js";
import { brandProfiles } from "./schema.js";
import { parseSource } from "./parser.js";
import { extractBrandData } from "./extractor.js";
import { ingestBrandDocument } from "./embedder.js";

const QUEUE_NAME = "anthyx-ingestor";
const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:6379";

const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

const worker = new Worker<IngestBrandPayload>(
  QUEUE_NAME,
  async (job) => {
    const { brandId, organizationId, sourceType, filePath, url, sourceName } = job.data;

    console.log(`[ingestor] Processing job ${job.id} for brand ${brandId}`);

    const parsed = await parseSource({ type: sourceType, path: filePath, url });
    const extraction = await extractBrandData(parsed.text);

    await ingestBrandDocument(
      parsed.text,
      brandId,
      organizationId,
      sourceName ?? parsed.sourceName,
      extraction,
    );

    await db
      .update(brandProfiles)
      .set({
        industry: extraction.industry,
        voiceTraits: extraction.voiceTraits,
        toneDescriptors: extraction.toneDescriptors,
        primaryColors: extraction.primaryColors,
        secondaryColors: extraction.secondaryColors,
        typography: extraction.typography,
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

worker.on("failed", (job, err) => {
  console.error(`[ingestor] Job ${job?.id} failed:`, err.message);
});

console.log(`[ingestor] Worker listening on queue: ${QUEUE_NAME}`);
