import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { randomBytes } from "crypto";
import { db } from "../db/client";
import { webhookEndpoints } from "../db/schema";
import { auth } from "../middleware/auth";

const router = Router();

const CreateWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).default([]),
  channels: z.array(z.string()).default([]),
});

// GET /webhooks
router.get("/", auth, async (req, res) => {
  const list = await db.query.webhookEndpoints.findMany({
    where: eq(webhookEndpoints.organizationId, req.user.orgId),
  });
  return res.json(list);
});

// POST /webhooks
router.post("/", auth, async (req, res) => {
  const parsed = CreateWebhookSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Validation failed" });

  const secret = randomBytes(24).toString("hex");

  const [endpoint] = await db
    .insert(webhookEndpoints)
    .values({
      organizationId: req.user.orgId,
      url: parsed.data.url,
      events: parsed.data.events,
      channels: parsed.data.channels,
      secret,
    })
    .returning();

  return res.status(201).json({ ...endpoint, secret }); // return secret once at creation
});

// PATCH /webhooks/:id
router.patch("/:id", auth, async (req, res) => {
  const parsed = CreateWebhookSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Validation failed" });

  const [updated] = await db
    .update(webhookEndpoints)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(webhookEndpoints.id, req.params.id!), eq(webhookEndpoints.organizationId, req.user.orgId)))
    .returning();

  if (!updated) return res.status(404).json({ error: "Not found" });
  return res.json(updated);
});

// DELETE /webhooks/:id
router.delete("/:id", auth, async (req, res) => {
  await db
    .delete(webhookEndpoints)
    .where(and(eq(webhookEndpoints.id, req.params.id!), eq(webhookEndpoints.organizationId, req.user.orgId)));
  return res.json({ ok: true });
});

export { router as webhooksRouter };
