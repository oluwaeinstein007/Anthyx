import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { organizations } from "../db/schema";
import { auth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { UpdateGuardrailsSchema, AddBlackoutSchema } from "@anthyx/config";
import type { SensitiveEvent } from "../services/agent/guardrails";
import { randomUUID } from "crypto";

const router = Router();

// GET /guardrails
router.get("/", auth, async (req, res) => {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, req.user.orgId),
  });
  const blackouts = (org?.sensitiveEventBlackouts as SensitiveEvent[] | null) ?? [];
  const now = new Date();
  const activeBlackouts = blackouts.filter(
    (e) => new Date(e.startDate) <= now && new Date(e.endDate) >= now,
  );

  return res.json({
    globalProhibitions: org?.globalProhibitions ?? [],
    blackouts,
    activeBlackouts,
  });
});

// PUT /guardrails
router.put("/", auth, validate(UpdateGuardrailsSchema), async (req, res) => {
  await db
    .update(organizations)
    .set({ globalProhibitions: req.body.globalProhibitions, updatedAt: new Date() })
    .where(eq(organizations.id, req.user.orgId));

  return res.json({ updated: true });
});

// POST /guardrails/blackouts
router.post("/blackouts", auth, validate(AddBlackoutSchema), async (req, res) => {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, req.user.orgId),
  });

  const existing = (org?.sensitiveEventBlackouts as SensitiveEvent[] | null) ?? [];
  const newBlackout: SensitiveEvent = {
    id: randomUUID(),
    name: req.body.name,
    startDate: req.body.startDate,
    endDate: req.body.endDate,
  };

  await db
    .update(organizations)
    .set({
      sensitiveEventBlackouts: [...existing, newBlackout],
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, req.user.orgId));

  return res.status(201).json(newBlackout);
});

// DELETE /guardrails/blackouts/:id
router.delete("/blackouts/:id", auth, async (req, res) => {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, req.user.orgId),
  });

  const existing = (org?.sensitiveEventBlackouts as SensitiveEvent[] | null) ?? [];
  const filtered = existing.filter((e) => e.id !== req.params.id);

  await db
    .update(organizations)
    .set({ sensitiveEventBlackouts: filtered, updatedAt: new Date() })
    .where(eq(organizations.id, req.user.orgId));

  return res.json({ deleted: true });
});

export { router as guardrailsRouter };
