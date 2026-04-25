import { Router } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client";
import { agents, brandProfiles } from "../db/schema";
import { auth } from "../middleware/auth";
import { repurposeBlogPost } from "../services/repurpose/blog-repurposer";
import { retrieveBrandVoiceFromQdrant } from "../services/agent/brand-context";
import type { Platform } from "@anthyx/types";

const router = Router();

const RepurposeSchema = z.object({
  url: z.string().url(),
  agentId: z.string().uuid(),
  platforms: z.array(z.string()).min(1).max(10),
});

// POST /repurpose/blog
// Extract a blog/article URL and reformat it as platform-specific social posts
router.post("/blog", auth, async (req, res) => {
  const parsed = RepurposeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });

  const { url, agentId, platforms } = parsed.data;

  const agent = await db.query.agents.findFirst({
    where: eq(agents.id, agentId),
  });
  if (!agent || agent.organizationId !== req.user.orgId) {
    return res.status(404).json({ error: "Agent not found" });
  }

  const brand = await db.query.brandProfiles.findFirst({
    where: eq(brandProfiles.id, agent.brandProfileId),
  });
  if (!brand) return res.status(404).json({ error: "Brand not found" });

  const brandVoice = await retrieveBrandVoiceFromQdrant(brand.id, "blog repurposing content");

  const result = await repurposeBlogPost(
    url,
    platforms as Platform[],
    brandVoice,
    agent.name,
    brand.name,
  );

  return res.json(result);
});

export { router as repurposeRouter };
