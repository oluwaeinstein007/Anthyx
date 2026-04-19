import { Router } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "../db/client";
import { agents, scheduledPosts, agentLogs } from "../db/schema";
import { auth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { requireLimit } from "../middleware/plan-limits";
import { CreateAgentSchema, UpdateAgentSchema, SilenceAgentSchema } from "@anthyx/config";
import { logAgentAction } from "../services/agent/logger";
import { postExecutionQueue } from "../queue/client";

const router = Router();

// GET /agents
router.get("/", auth, async (req, res) => {
  const list = await db.query.agents.findMany({
    where: eq(agents.organizationId, req.user.orgId),
  });
  return res.json(list);
});

// POST /agents
router.post("/", auth, requireLimit("agent"), validate(CreateAgentSchema), async (req, res) => {

  const [agent] = await db
    .insert(agents)
    .values({
      organizationId: req.user.orgId,
      brandProfileId: req.body.brandProfileId,
      name: req.body.name,
      description: req.body.description,
      dietInstructions: req.body.dietInstructions,
      systemPromptOverride: req.body.systemPromptOverride,
    })
    .returning();

  return res.status(201).json(agent);
});

// GET /agents/:id
router.get("/:id", auth, async (req, res) => {
  const agent = await db.query.agents.findFirst({
    where: and(eq(agents.id, req.params.id!), eq(agents.organizationId, req.user.orgId)),
  });
  if (!agent) return res.status(404).json({ error: "Not found" });
  return res.json(agent);
});

// PUT /agents/:id
router.put("/:id", auth, validate(UpdateAgentSchema), async (req, res) => {
  const [updated] = await db
    .update(agents)
    .set({ ...req.body, updatedAt: new Date() })
    .where(and(eq(agents.id, req.params.id!), eq(agents.organizationId, req.user.orgId)))
    .returning();

  if (!updated) return res.status(404).json({ error: "Not found" });
  return res.json(updated);
});

// DELETE /agents/:id
router.delete("/:id", auth, async (req, res) => {
  await db
    .delete(agents)
    .where(and(eq(agents.id, req.params.id!), eq(agents.organizationId, req.user.orgId)));
  return res.json({ ok: true });
});

// POST /agents/:id/silence
router.post("/:id/silence", auth, validate(SilenceAgentSchema), async (req, res) => {
  const agentId = req.params.id!;
  const { reason } = req.body;

  // 1. Mark agent inactive
  await db
    .update(agents)
    .set({ isActive: false, silencedAt: new Date(), silenceReason: reason, updatedAt: new Date() })
    .where(and(eq(agents.id, agentId), eq(agents.organizationId, req.user.orgId)));

  // 2. Cancel all pending BullMQ jobs for this agent's posts
  const pendingPosts = await db.query.scheduledPosts.findMany({
    where: and(
      eq(scheduledPosts.agentId, agentId),
      inArray(scheduledPosts.status, ["approved", "scheduled"]),
    ),
  });

  for (const post of pendingPosts) {
    if (post.bullJobId) {
      const job = await postExecutionQueue.getJob(post.bullJobId);
      await job?.remove();
    }
    await db
      .update(scheduledPosts)
      .set({ status: "silenced", updatedAt: new Date() })
      .where(eq(scheduledPosts.id, post.id));
  }

  await logAgentAction(req.user.orgId, agentId, null, "agent_silenced", {
    reason,
    triggeredBy: req.user.id,
    cancelledPosts: pendingPosts.length,
  });

  return res.json({ silenced: true, cancelledPosts: pendingPosts.length });
});

// POST /agents/:id/resume
router.post("/:id/resume", auth, async (req, res) => {
  const agentId = req.params.id!;

  await db
    .update(agents)
    .set({ isActive: true, silencedAt: null, silenceReason: null, updatedAt: new Date() })
    .where(and(eq(agents.id, agentId), eq(agents.organizationId, req.user.orgId)));

  await logAgentAction(req.user.orgId, agentId, null, "agent_resumed", {
    triggeredBy: req.user.id,
  });

  return res.json({ resumed: true });
});

// POST /agents/:id/assign
router.post("/:id/assign", auth, async (req, res) => {
  const { socialAccountId } = req.body;
  if (!socialAccountId) return res.status(400).json({ error: "socialAccountId required" });

  const { socialAccounts } = await import("../db/schema");
  const [updated] = await db
    .update(socialAccounts)
    .set({ agentId: req.params.id, updatedAt: new Date() })
    .where(and(
      eq(socialAccounts.id, socialAccountId),
      eq(socialAccounts.organizationId, req.user.orgId),
    ))
    .returning();

  if (!updated) return res.status(404).json({ error: "Social account not found" });
  return res.json(updated);
});

// GET /agents/:id/logs
router.get("/:id/logs", auth, async (req, res) => {
  const agent = await db.query.agents.findFirst({
    where: and(eq(agents.id, req.params.id!), eq(agents.organizationId, req.user.orgId)),
  });
  if (!agent) return res.status(404).json({ error: "Not found" });

  const limit = Math.min(parseInt(req.query["limit"] as string) || 50, 100);
  const offset = parseInt(req.query["offset"] as string) || 0;
  const action = req.query["action"] as string | undefined;

  const logs = await db.query.agentLogs.findMany({
    where: and(
      eq(agentLogs.agentId, agent.id),
      ...(action ? [eq(agentLogs.action, action)] : []),
    ),
    orderBy: (l, { desc }) => [desc(l.createdAt)],
    limit,
    offset,
  });

  return res.json(logs);
});

export { router as agentsRouter };
