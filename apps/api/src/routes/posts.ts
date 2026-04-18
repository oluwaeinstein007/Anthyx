import { Router } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "../db/client";
import { scheduledPosts, postAnalytics } from "../db/schema";
import { auth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { requireLimit } from "../middleware/plan-limits";
import {
  ApprovePostSchema,
  VetoPostSchema,
  ReschedulePostSchema,
  UpdatePostSchema,
  BatchApproveSchema,
} from "@anthyx/config";
import { schedulePostJob } from "../queue/jobs";

const router = Router();

// GET /posts/review — posts pending human review
router.get("/review", auth, async (req, res) => {
  const posts = await db.query.scheduledPosts.findMany({
    where: and(
      eq(scheduledPosts.organizationId, req.user.orgId),
      eq(scheduledPosts.status, "pending_review"),
    ),
  });
  return res.json(posts);
});

// GET /posts/review/buffer — next 5 per agent
router.get("/review/buffer", auth, async (req, res) => {
  const posts = await db.query.scheduledPosts.findMany({
    where: and(
      eq(scheduledPosts.organizationId, req.user.orgId),
      eq(scheduledPosts.status, "pending_review"),
    ),
    limit: 20,
    orderBy: (p, { asc }) => [asc(p.scheduledAt)],
  });

  // Group by agentId and take first 5 per agent
  const byAgent = new Map<string, typeof posts>();
  for (const post of posts) {
    const existing = byAgent.get(post.agentId) ?? [];
    if (existing.length < 5) existing.push(post);
    byAgent.set(post.agentId, existing);
  }

  return res.json(Object.fromEntries(byAgent));
});

// PUT /posts/:id
router.put("/:id", auth, validate(UpdatePostSchema), async (req, res) => {
  const [updated] = await db
    .update(scheduledPosts)
    .set({ ...req.body, updatedAt: new Date() })
    .where(
      and(
        eq(scheduledPosts.id, req.params.id!),
        eq(scheduledPosts.organizationId, req.user.orgId),
      ),
    )
    .returning();

  if (!updated) return res.status(404).json({ error: "Not found" });
  return res.json(updated);
});

// POST /posts/:id/approve
router.post("/:id/approve", auth, requireLimit("post"), validate(ApprovePostSchema), async (req, res) => {

  const post = await db.query.scheduledPosts.findFirst({
    where: and(
      eq(scheduledPosts.id, req.params.id!),
      eq(scheduledPosts.organizationId, req.user.orgId),
    ),
  });
  if (!post) return res.status(404).json({ error: "Not found" });

  // Mark approved
  await db
    .update(scheduledPosts)
    .set({
      status: "approved",
      reviewedBy: req.user.id,
      reviewedAt: new Date(),
      reviewNotes: req.body.reviewNotes,
      updatedAt: new Date(),
    })
    .where(eq(scheduledPosts.id, post.id));

  // Schedule the BullMQ job
  const jobId = await schedulePostJob(post.id, post.scheduledAt);

  return res.json({ approved: true, jobId });
});

// POST /posts/approve-batch
router.post("/approve-batch", auth, requireLimit("post"), validate(BatchApproveSchema), async (req, res) => {
  const { postIds, reviewNotes } = req.body;

  const posts = await db.query.scheduledPosts.findMany({
    where: and(
      inArray(scheduledPosts.id, postIds),
      eq(scheduledPosts.organizationId, req.user.orgId),
      eq(scheduledPosts.status, "pending_review"),
    ),
  });

  const jobIds: string[] = [];
  for (const post of posts) {

    await db
      .update(scheduledPosts)
      .set({
        status: "approved",
        reviewedBy: req.user.id,
        reviewedAt: new Date(),
        reviewNotes,
        updatedAt: new Date(),
      })
      .where(eq(scheduledPosts.id, post.id));

    const jobId = await schedulePostJob(post.id, post.scheduledAt);
    jobIds.push(jobId);
  }

  return res.json({ approved: posts.length, jobIds });
});

// POST /posts/:id/veto
router.post("/:id/veto", auth, validate(VetoPostSchema), async (req, res) => {
  await db
    .update(scheduledPosts)
    .set({
      status: "vetoed",
      reviewedBy: req.user.id,
      reviewedAt: new Date(),
      reviewNotes: req.body.reason,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(scheduledPosts.id, req.params.id!),
        eq(scheduledPosts.organizationId, req.user.orgId),
      ),
    );

  return res.json({ vetoed: true });
});

// POST /posts/:id/reschedule
router.post("/:id/reschedule", auth, validate(ReschedulePostSchema), async (req, res) => {
  const newDate = new Date(req.body.scheduledAt);

  const [updated] = await db
    .update(scheduledPosts)
    .set({ scheduledAt: newDate, updatedAt: new Date() })
    .where(
      and(
        eq(scheduledPosts.id, req.params.id!),
        eq(scheduledPosts.organizationId, req.user.orgId),
      ),
    )
    .returning();

  if (!updated) return res.status(404).json({ error: "Not found" });
  return res.json(updated);
});

// GET /posts/:id/analytics
router.get("/:id/analytics", auth, async (req, res) => {
  const post = await db.query.scheduledPosts.findFirst({
    where: and(
      eq(scheduledPosts.id, req.params.id!),
      eq(scheduledPosts.organizationId, req.user.orgId),
    ),
  });
  if (!post) return res.status(404).json({ error: "Not found" });

  const analytics = await db.query.postAnalytics.findMany({
    where: eq(postAnalytics.postId, post.id),
    orderBy: (a, { desc }) => [desc(a.fetchedAt)],
  });

  return res.json(analytics);
});

export { router as postsRouter };
