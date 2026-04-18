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

    let sourceType: "pdf" | "markdown" | "url";
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
    } else {
      return res.status(400).json({ error: "Provide a file or URL" });
    }

    const job = await ingestorQueue.add("ingest-brand", {
      brandId: brand.id,
      organizationId: req.user.orgId,
      sourceType,
      filePath,
      url,
      sourceName,
    });

    return res.status(202).json({ jobId: job.id, status: "queued" });
  },
);

export { router as brandsRouter };
