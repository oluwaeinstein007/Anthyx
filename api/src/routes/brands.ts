import { Router } from "express";
import { eq, and, isNull, isNotNull, count, inArray } from "drizzle-orm";
import multer from "multer";
import * as path from "path";
import { db } from "../db/client";
import { brandProfiles, scheduledPosts, agents, socialAccounts, agentSocialAccounts } from "../db/schema";
import { auth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { requireLimit } from "../middleware/plan-limits";
import { CreateBrandSchema } from "@anthyx/config";
import { ingestorQueue } from "../queue/client";
import { computeQualityImprovement } from "../services/agent/veto-learner";
import type { IngestProgress } from "../workers/ingestor.worker";

const router = Router();
const upload = multer({ dest: "/tmp/anthyx-uploads/", limits: { fileSize: 50 * 1024 * 1024 } });

// GET /brands?includeArchived=true
router.get("/", auth, async (req, res) => {
  const includeArchived = req.query["includeArchived"] === "true";

  const brands = await db.query.brandProfiles.findMany({
    where: and(
      eq(brandProfiles.organizationId, req.user.orgId),
      includeArchived ? undefined : isNull(brandProfiles.archivedAt),
    ),
    orderBy: (b, { desc }) => [desc(b.createdAt)],
  });

  // Attach quick-stats: total posts generated + pending review count
  const brandIds = brands.map((b) => b.id);
  const stats = await Promise.all(
    brandIds.map(async (bid) => {
      const [total, pending] = await Promise.all([
        db.select({ c: count() }).from(scheduledPosts)
          .where(and(eq(scheduledPosts.brandProfileId, bid), eq(scheduledPosts.organizationId, req.user.orgId)))
          .then((r) => r[0]?.c ?? 0),
        db.select({ c: count() }).from(scheduledPosts)
          .where(and(
            eq(scheduledPosts.brandProfileId, bid),
            eq(scheduledPosts.organizationId, req.user.orgId),
            eq(scheduledPosts.status, "pending_review"),
          ))
          .then((r) => r[0]?.c ?? 0),
      ]);
      return { brandId: bid, totalPosts: Number(total), pendingReview: Number(pending) };
    }),
  );

  const statsMap = new Map(stats.map((s) => [s.brandId, s]));

  return res.json(brands.map((b) => ({
    ...b,
    _stats: statsMap.get(b.id) ?? { brandId: b.id, totalPosts: 0, pendingReview: 0 },
  })));
});

// POST /brands
router.post("/", auth, requireLimit("brand"), validate(CreateBrandSchema), async (req, res) => {
  const [brand] = await db
    .insert(brandProfiles)
    .values({
      organizationId: req.user.orgId,
      name: req.body.name,
      industry: req.body.industry,
    })
    .returning();

  return res.status(201).json(brand);
});

// GET /brands/:id
router.get("/:id", auth, async (req, res) => {
  const brand = await db.query.brandProfiles.findFirst({
    where: and(
      eq(brandProfiles.id, req.params.id!),
      eq(brandProfiles.organizationId, req.user.orgId),
    ),
  });
  if (!brand) return res.status(404).json({ error: "Not found" });
  return res.json(brand);
});

// PUT /brands/:id
router.put("/:id", auth, async (req, res) => {
  const [updated] = await db
    .update(brandProfiles)
    .set({ ...req.body, updatedAt: new Date() })
    .where(
      and(
        eq(brandProfiles.id, req.params.id!),
        eq(brandProfiles.organizationId, req.user.orgId),
      ),
    )
    .returning();

  if (!updated) return res.status(404).json({ error: "Not found" });
  return res.json(updated);
});

// DELETE /brands/:id
router.delete("/:id", auth, async (req, res) => {
  await db
    .delete(brandProfiles)
    .where(
      and(
        eq(brandProfiles.id, req.params.id!),
        eq(brandProfiles.organizationId, req.user.orgId),
      ),
    );
  return res.json({ ok: true });
});

// POST /brands/:id/ingest — supports single file, multiple files, URL, or text
router.post(
  "/:id/ingest",
  auth,
  upload.array("files", 10),
  async (req, res) => {
    const brand = await db.query.brandProfiles.findFirst({
      where: and(
        eq(brandProfiles.id, req.params.id!),
        eq(brandProfiles.organizationId, req.user.orgId),
      ),
    });
    if (!brand) return res.status(404).json({ error: "Brand not found" });

    const files = (req.files as Express.Multer.File[] | undefined) ?? [];

    // Multi-file: queue one job per file
    if (files.length > 0) {
      const jobs = await Promise.all(
        files.map((file) => {
          const ext = path.extname(file.originalname).toLowerCase();
          const sourceType = ext === ".pdf" ? "pdf" : "markdown";
          return ingestorQueue.add("ingest-brand", {
            brandId: brand.id,
            organizationId: req.user.orgId,
            sourceType,
            filePath: file.path,
            sourceName: file.originalname,
          });
        }),
      );
      return res.status(202).json({ jobs: jobs.map((j) => ({ jobId: j.id, status: "queued" })) });
    }

    // URL or plaintext
    if (req.body.url) {
      const job = await ingestorQueue.add("ingest-brand", {
        brandId: brand.id,
        organizationId: req.user.orgId,
        sourceType: "url",
        url: req.body.url as string,
        sourceName: req.body.url as string,
      });
      return res.status(202).json({ jobs: [{ jobId: job.id, status: "queued" }] });
    }

    if (req.body.text) {
      const job = await ingestorQueue.add("ingest-brand", {
        brandId: brand.id,
        organizationId: req.user.orgId,
        sourceType: "plaintext",
        rawText: req.body.text as string,
        sourceName: "raw-text",
      });
      return res.status(202).json({ jobs: [{ jobId: job.id, status: "queued" }] });
    }

    return res.status(400).json({ error: "Provide files, URL, or text" });
  },
);

// GET /brands/:id/ingest-job/:jobId — poll a queued ingestion job's progress
router.get("/:id/ingest-job/:jobId", auth, async (req, res) => {
  const job = await ingestorQueue.getJob(req.params.jobId!);
  if (!job) return res.status(404).json({ error: "Job not found" });

  const state = await job.getState();
  const progress = (job.progress ?? null) as IngestProgress | null;

  return res.json({
    jobId: job.id,
    state,   // waiting | active | completed | failed | delayed | unknown
    progress,
    failedReason: job.failedReason ?? null,
  });
});

// POST /brands/:id/archive — soft-archive a brand
router.post("/:id/archive", auth, async (req, res) => {
  const brand = await db.query.brandProfiles.findFirst({
    where: and(
      eq(brandProfiles.id, req.params.id!),
      eq(brandProfiles.organizationId, req.user.orgId),
    ),
  });
  if (!brand) return res.status(404).json({ error: "Not found" });

  const [updated] = await db
    .update(brandProfiles)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(brandProfiles.id, brand.id))
    .returning();

  return res.json(updated);
});

// POST /brands/:id/unarchive — restore an archived brand
router.post("/:id/unarchive", auth, async (req, res) => {
  const brand = await db.query.brandProfiles.findFirst({
    where: and(
      eq(brandProfiles.id, req.params.id!),
      eq(brandProfiles.organizationId, req.user.orgId),
    ),
  });
  if (!brand) return res.status(404).json({ error: "Not found" });

  const [updated] = await db
    .update(brandProfiles)
    .set({ archivedAt: null, updatedAt: new Date() })
    .where(eq(brandProfiles.id, brand.id))
    .returning();

  return res.json(updated);
});

// POST /brands/:id/duplicate — clone a brand (copies all profile fields, new name)
router.post("/:id/duplicate", auth, requireLimit("brand"), async (req, res) => {
  const brand = await db.query.brandProfiles.findFirst({
    where: and(
      eq(brandProfiles.id, req.params.id!),
      eq(brandProfiles.organizationId, req.user.orgId),
    ),
  });
  if (!brand) return res.status(404).json({ error: "Not found" });

  const {
    id: _id, createdAt: _c, updatedAt: _u, archivedAt: _a,
    qdrantCollectionId: _q, ingestStatus: _s, ingestHistory: _h,
    sourceFiles: _sf, ...copyFields
  } = brand;

  const [clone] = await db
    .insert(brandProfiles)
    .values({
      ...copyFields,
      name: `${brand.name} (copy)`,
      organizationId: req.user.orgId,
      ingestStatus: "idle",
    })
    .returning();

  return res.status(201).json(clone);
});

// GET /brands/:id/quality-improvement — AI quality improvement stats for a brand
router.get("/:id/quality-improvement", auth, async (req, res) => {
  const brand = await db.query.brandProfiles.findFirst({
    where: and(
      eq(brandProfiles.id, req.params.id!),
      eq(brandProfiles.organizationId, req.user.orgId),
    ),
  });
  if (!brand) return res.status(404).json({ error: "Not found" });

  const days = parseInt((req.query["days"] as string) ?? "60");
  const stats = await computeQualityImprovement(brand.id, req.user.orgId, Math.min(days, 180));
  return res.json(stats);
});

// POST /brands/:id/tone-preview — AI-generate a sample paragraph from current brand voice
router.post("/:id/tone-preview", auth, async (req, res) => {
  const brand = await db.query.brandProfiles.findFirst({
    where: and(
      eq(brandProfiles.id, req.params.id!),
      eq(brandProfiles.organizationId, req.user.orgId),
    ),
  });
  if (!brand) return res.status(404).json({ error: "Not found" });

  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(process.env["GEMINI_API_KEY"] ?? "");
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const traits = Array.isArray(brand.voiceTraits)
    ? (brand.voiceTraits as string[]).join(", ")
    : JSON.stringify(brand.voiceTraits ?? {});
  const tone = (brand.toneDescriptors ?? []).join(", ");
  const examples = (brand.voiceExamples ?? []).slice(0, 2).map((e, i) => `Example ${i + 1}: "${e}"`).join("\n");

  const prompt = `You are a brand copywriter. Write a single short social media post (2–4 sentences) that perfectly demonstrates this brand's voice.

Brand: ${brand.name}
Industry: ${brand.industry ?? "general"}
Voice traits: ${traits || "not specified"}
Tone descriptors: ${tone || "not specified"}
${examples ? `\nExisting voice examples (learn from these):\n${examples}` : ""}
Mission: ${brand.missionStatement ?? "not specified"}

Write only the post itself. No commentary, no hashtags, no labels.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    return res.json({ preview: text });
  } catch {
    return res.status(500).json({ error: "Preview generation failed" });
  }
});

// GET /brands/:id/channels — social accounts linked to agents of this brand
router.get("/:id/channels", auth, async (req, res) => {
  const brand = await db.query.brandProfiles.findFirst({
    where: and(
      eq(brandProfiles.id, req.params.id!),
      eq(brandProfiles.organizationId, req.user.orgId),
    ),
  });
  if (!brand) return res.status(404).json({ error: "Not found" });

  const brandAgents = await db.query.agents.findMany({
    where: and(
      eq(agents.brandProfileId, req.params.id!),
      eq(agents.organizationId, req.user.orgId),
    ),
  });

  if (brandAgents.length === 0) return res.json([]);

  const agentIds = brandAgents.map((a) => a.id);

  // Fetch all social accounts assigned to any agent of this brand
  const links = await db.query.agentSocialAccounts.findMany({
    where: inArray(agentSocialAccounts.agentId, agentIds),
  });
  const accountIds = [...new Set(links.map((l) => l.socialAccountId))];
  const accounts = accountIds.length > 0
    ? await db.query.socialAccounts.findMany({
        where: and(
          eq(socialAccounts.organizationId, req.user.orgId),
          inArray(socialAccounts.id, accountIds),
        ),
      })
    : [];

  return res.json(
    accounts.map(({ accessToken, refreshToken, ...rest }) => rest),
  );
});

export { router as brandsRouter };
