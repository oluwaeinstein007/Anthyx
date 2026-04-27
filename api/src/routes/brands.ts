import { Router } from "express";
import { eq, and } from "drizzle-orm";
import multer from "multer";
import * as path from "path";
import { db } from "../db/client";
import { brandProfiles } from "../db/schema";
import { auth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { requireLimit } from "../middleware/plan-limits";
import { CreateBrandSchema } from "@anthyx/config";
import { ingestorQueue } from "../queue/client";
import { computeQualityImprovement } from "../services/agent/veto-learner";

const router = Router();
const upload = multer({ dest: "/tmp/anthyx-uploads/" });

// GET /brands
router.get("/", auth, async (req, res) => {
  const brands = await db.query.brandProfiles.findMany({
    where: eq(brandProfiles.organizationId, req.user.orgId),
  });
  return res.json(brands);
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

// POST /brands/:id/ingest
router.post(
  "/:id/ingest",
  auth,
  upload.single("file"),
  async (req, res) => {
    const brand = await db.query.brandProfiles.findFirst({
      where: and(
        eq(brandProfiles.id, req.params.id!),
        eq(brandProfiles.organizationId, req.user.orgId),
      ),
    });
    if (!brand) return res.status(404).json({ error: "Brand not found" });

    let sourceType: "pdf" | "markdown" | "url" | "plaintext";
    let filePath: string | undefined;
    let url: string | undefined;
    let sourceName: string | undefined;

    if (req.file) {
      const ext = path.extname(req.file.originalname).toLowerCase();
      sourceType = ext === ".pdf" ? "pdf" : "markdown";
      filePath = req.file.path;
      sourceName = req.file.originalname;
    } else if (req.body.url) {
      sourceType = "url";
      url = req.body.url as string;
      sourceName = url;
    } else if (req.body.text) {
      sourceType = "plaintext";
      sourceName = "raw-text";
    } else {
      return res.status(400).json({ error: "Provide a file, URL, or text" });
    }

    const job = await ingestorQueue.add("ingest-brand", {
      brandId: brand.id,
      organizationId: req.user.orgId,
      sourceType,
      filePath,
      url,
      rawText: req.body.text as string | undefined,
      sourceName,
    });

    return res.status(202).json({ jobId: job.id, status: "queued" });
  },
);

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

export { router as brandsRouter };
