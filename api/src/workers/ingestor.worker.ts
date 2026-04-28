import { Worker, type Job } from "bullmq";
import { eq, sql, and } from "drizzle-orm";
import { db } from "../db/client";
import { brandProfiles, competitors } from "../db/schema";
import { redisConnection } from "../queue/client";
import { parsePdf, parseUrl, parseMarkdown } from "../services/brand-ingestion/parser";
import { extractBrandData } from "../services/brand-ingestion/extractor";
import { ingestBrandDocument } from "../services/brand-ingestion/embedder";
import { suggestCompetitors } from "../services/agent/competitive-analyst";

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

// ── Merge helpers ──────────────────────────────────────────────────────────────

function mergeArr<T>(existing: T[] | null | undefined, incoming: T[] | null | undefined): T[] {
  return Array.from(new Set([...(existing ?? []), ...(incoming ?? [])]));
}

function mergeCoreValues(
  existing: { label: string; description?: string }[] | null | undefined,
  incoming: { label: string; description?: string }[] | null | undefined,
): { label: string; description?: string }[] {
  const map = new Map((existing ?? []).map((v) => [v.label.toLowerCase(), v]));
  for (const val of incoming ?? []) {
    if (!map.has(val.label.toLowerCase())) map.set(val.label.toLowerCase(), val);
    // Existing entry wins — don't overwrite manually-written descriptions
  }
  return Array.from(map.values());
}

function mergeVoiceTraits(
  existing: Record<string, boolean> | null | undefined,
  incoming: Record<string, boolean> | null | undefined,
): Record<string, boolean> {
  const result: Record<string, boolean> = { ...(incoming ?? {}) };
  // Preserve any trait the user explicitly enabled — never flip a true back to false
  for (const [k, v] of Object.entries(existing ?? {})) {
    if (v === true) result[k] = true;
  }
  return result;
}

// ── Worker ─────────────────────────────────────────────────────────────────────

const worker = new Worker<IngestJobData>(
  "anthyx-ingestor",
  async (job: Job<IngestJobData>) => {
    const { brandId, organizationId, sourceType, filePath, url, rawText, sourceName } = job.data;

    console.log(`[IngestorWorker] Processing ingestion for brand ${brandId}, type: ${sourceType}`);

    await db
      .update(brandProfiles)
      .set({ ingestStatus: "processing", updatedAt: new Date() })
      .where(eq(brandProfiles.id, brandId));

    // Fetch current brand for fill-gaps comparison
    const currentBrand = await db.query.brandProfiles.findFirst({
      where: eq(brandProfiles.id, brandId),
    });
    if (!currentBrand) throw new Error(`Brand ${brandId} not found`);

    // Step 1: Parse
    await job.updateProgress({ step: "parsing", message: "Parsing document…" } satisfies IngestProgress);

    let text: string;
    if (sourceType === "pdf" && filePath) {
      text = (await parsePdf(filePath)).text;
    } else if (sourceType === "markdown" && filePath) {
      text = (await parseMarkdown(filePath)).text;
    } else if (sourceType === "url" && url) {
      text = (await parseUrl(url)).text;
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

    // Read full competitor list — used for brandContext and to filter suggestions
    const allCompetitors = await db.query.competitors.findMany({
      where: eq(competitors.brandProfileId, brandId),
      columns: { name: true },
    });
    const allCompetitorNames = allCompetitors.map((c) => c.name);

    // Generate competitor suggestions via LLM (non-critical — silently skip on failure)
    const ctx = (currentBrand.brandContext ?? {}) as {
      brandStatements?: string[];
      audienceNotes?: string[];
      productsServices?: string[];
      valueProposition?: string | null;
      targetMarket?: string | null;
      contentPillars?: string[];
      competitors?: string[];
      competitorSuggestions?: string[];
    };

    let competitorSuggestions: string[] = ctx.competitorSuggestions ?? [];
    try {
      const industry = extraction.industry || currentBrand.industry || "general";
      const positioning = extraction.valueProposition ?? ctx.valueProposition ?? null;
      const fresh = await suggestCompetitors(currentBrand.name, industry, positioning, allCompetitorNames);
      // Filter out any that were just auto-discovered this ingestion
      competitorSuggestions = fresh.filter(
        (s) => !allCompetitorNames.some((n) => n.toLowerCase() === s.toLowerCase()),
      );
    } catch (err) {
      console.warn("[IngestorWorker] Competitor suggestion failed (non-critical):", err);
    }

    // Build the merged brandContext — fill-gaps for scalar fields, union for arrays
    const mergedContext = {
      brandStatements: mergeArr(ctx.brandStatements, extraction.brandStatements),
      audienceNotes: mergeArr(ctx.audienceNotes, extraction.audienceNotes),
      productsServices: mergeArr(ctx.productsServices, extraction.productsServices),
      valueProposition: ctx.valueProposition ?? extraction.valueProposition ?? null,
      targetMarket: ctx.targetMarket ?? extraction.targetMarket ?? null,
      contentPillars: mergeArr(ctx.contentPillars, extraction.contentPillars),
      competitors: allCompetitorNames,
      competitorSuggestions,
    };

    const historyEntry = {
      sourceType,
      sourceName: sourceName ?? "document",
      ingestedAt: new Date().toISOString(),
      summary: extraction.valueProposition ?? `Extracted ${extraction.toneDescriptors?.length ?? 0} tone descriptors`,
    };

    await db
      .update(brandProfiles)
      .set({
        // ── Scalar fill-gaps: only write if the DB field is currently empty ──
        ...(!currentBrand.industry && extraction.industry ? { industry: extraction.industry } : {}),
        ...(!currentBrand.tagline && extraction.tagline ? { tagline: extraction.tagline } : {}),
        ...(!currentBrand.websiteUrl && extraction.websiteUrl ? { websiteUrl: extraction.websiteUrl } : {}),
        ...(!currentBrand.brandEmail && extraction.brandEmail ? { brandEmail: extraction.brandEmail } : {}),
        ...(extraction.brandStage ? { brandStage: extraction.brandStage } : {}),
        ...(!currentBrand.missionStatement && extraction.missionStatement ? { missionStatement: extraction.missionStatement } : {}),
        ...(!currentBrand.visionStatement && extraction.visionStatement ? { visionStatement: extraction.visionStatement } : {}),
        ...(!currentBrand.originStory && extraction.originStory ? { originStory: extraction.originStory } : {}),
        // ── Array merge: union existing + extracted ──
        ...((extraction.coreValues?.length ?? 0) > 0
          ? { coreValues: mergeCoreValues(currentBrand.coreValues as { label: string; description?: string }[] | null, extraction.coreValues) }
          : {}),
        ...((extraction.voiceExamples?.length ?? 0) > 0
          ? { voiceExamples: mergeArr(currentBrand.voiceExamples, extraction.voiceExamples) }
          : {}),
        ...((extraction.contentDos?.length ?? 0) > 0
          ? { contentDos: mergeArr(currentBrand.contentDos, extraction.contentDos) }
          : {}),
        ...((extraction.bannedWords?.length ?? 0) > 0
          ? { bannedWords: mergeArr(currentBrand.bannedWords, extraction.bannedWords) }
          : {}),
        // ── Voice traits: OR-merge so user-enabled traits are never cleared ──
        voiceTraits: mergeVoiceTraits(
          currentBrand.voiceTraits as Record<string, boolean> | null,
          extraction.voiceTraits,
        ),
        // ── Tone descriptors: union ──
        toneDescriptors: mergeArr(currentBrand.toneDescriptors, extraction.toneDescriptors),
        // ── Colors / typography: fill-gaps only (never overwrite designer choices) ──
        ...((currentBrand.primaryColors?.length ?? 0) === 0 && (extraction.primaryColors?.length ?? 0) > 0
          ? { primaryColors: extraction.primaryColors }
          : {}),
        ...((currentBrand.secondaryColors?.length ?? 0) === 0 && (extraction.secondaryColors?.length ?? 0) > 0
          ? { secondaryColors: extraction.secondaryColors }
          : {}),
        ...(!currentBrand.typography && extraction.typography?.primary ? { typography: extraction.typography } : {}),
        // ── brandContext: smart-merged ──
        brandContext: mergedContext,
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
