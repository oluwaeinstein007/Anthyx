import { Router } from "express";
import { eq, and, inArray, type SQL } from "drizzle-orm";
import { db } from "../db/client";
import { scheduledPosts, postAnalytics, abTests } from "../db/schema";
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
import { generateAbVariants, evaluateAndPromoteWinner } from "../services/agent/ab-tester";

const router = Router();

// GET /posts/review — posts pending human review, with filter support
// Query params: brandProfileId, platform, contentType, limit, offset
router.get("/review", auth, async (req, res) => {
  const { brandProfileId, platform, contentType, limit: limitStr, offset: offsetStr } = req.query as Record<string, string | undefined>;

  const filters: SQL[] = [
    eq(scheduledPosts.organizationId, req.user.orgId),
    eq(scheduledPosts.status, "pending_review"),
  ];

  if (brandProfileId) filters.push(eq(scheduledPosts.brandProfileId, brandProfileId));
  if (platform) filters.push(eq(scheduledPosts.platform, platform as never));
  if (contentType) filters.push(eq(scheduledPosts.contentType, contentType));

  const limit = Math.min(parseInt(limitStr ?? "50"), 200);
  const offset = parseInt(offsetStr ?? "0");

  const posts = await db.query.scheduledPosts.findMany({
    where: and(...filters),
    orderBy: (p, { asc }) => [asc(p.scheduledAt)],
    limit,
    offset,
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

  // Only schedule BullMQ job if a social account is linked; otherwise the post
  // stays in "approved" state until the user connects an account and reschedules.
  if (!post.socialAccountId) {
    return res.json({ approved: true, jobId: null, warning: `No ${post.platform} account linked — post approved but not scheduled. Connect an account to schedule it.` });
  }

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

    // Skip scheduling if no account linked — post stays "approved" until account is connected.
    if (post.socialAccountId) {
      const jobId = await schedulePostJob(post.id, post.scheduledAt);
      jobIds.push(jobId);
    }
  }

  return res.json({ approved: posts.length, jobIds });
});

// POST /posts/veto-batch
router.post("/veto-batch", auth, async (req, res) => {
  const { postIds, reason } = req.body as { postIds: string[]; reason?: string };
  if (!Array.isArray(postIds) || postIds.length === 0) {
    return res.status(400).json({ error: "postIds must be a non-empty array" });
  }

  const posts = await db.query.scheduledPosts.findMany({
    where: and(
      inArray(scheduledPosts.id, postIds),
      eq(scheduledPosts.organizationId, req.user.orgId),
      eq(scheduledPosts.status, "pending_review"),
    ),
  });

  for (const post of posts) {
    await db
      .update(scheduledPosts)
      .set({
        status: "vetoed",
        reviewedBy: req.user.id,
        reviewedAt: new Date(),
        reviewNotes: reason ?? null,
        updatedAt: new Date(),
      })
      .where(eq(scheduledPosts.id, post.id));
  }

  return res.json({ vetoed: posts.length });
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

// GET /posts/:id — get single post
router.get("/:id", auth, async (req, res) => {
  const post = await db.query.scheduledPosts.findFirst({
    where: and(eq(scheduledPosts.id, req.params.id!), eq(scheduledPosts.organizationId, req.user.orgId)),
  });
  if (!post) return res.status(404).json({ error: "Not found" });
  return res.json(post);
});

// GET /posts/ab-tests — list A/B tests for the org
router.get("/ab-tests", auth, async (req, res) => {
  const tests = await db.query.abTests.findMany({
    where: eq(abTests.organizationId, req.user.orgId),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
    limit: 50,
  });
  return res.json(tests);
});

// POST /posts/:id/ab-test — generate a second content variant for A/B testing
router.post("/:id/ab-test", auth, async (req, res) => {
  const result = await generateAbVariants(req.params.id!, req.user.orgId);
  return res.status(201).json(result);
});

// POST /posts/ab-tests/:abTestId/promote — evaluate and promote A/B test winner
router.post("/ab-tests/:abTestId/promote", auth, async (req, res) => {
  const result = await evaluateAndPromoteWinner(req.params.abTestId!);
  return res.json(result);
});

// POST /posts/:id/regenerate-image — regenerate AI image for a draft/pending post
router.post("/:id/regenerate-image", auth, async (req, res) => {
  const post = await db.query.scheduledPosts.findFirst({
    where: and(
      eq(scheduledPosts.id, req.params.id!),
      eq(scheduledPosts.organizationId, req.user.orgId),
    ),
  });
  if (!post) return res.status(404).json({ error: "Not found" });
  if (!["draft", "pending_review"].includes(post.status!)) {
    return res.status(400).json({ error: "Can only regenerate image for draft or pending_review posts" });
  }

  const prompt = (req.body as { prompt?: string }).prompt ?? post.suggestedMediaPrompt;
  if (!prompt) return res.status(400).json({ error: "No media prompt — provide one in the request body" });

  const { generateAssetForPost } = await import("../services/assets/generator");
  const mediaUrl = await generateAssetForPost({
    contentText: post.contentText,
    suggestedMediaPrompt: prompt,
    assetTrack: "ai",
  });

  if (!mediaUrl) return res.status(500).json({ error: "Image generation returned no result" });

  await db
    .update(scheduledPosts)
    .set({ mediaUrls: [mediaUrl], suggestedMediaPrompt: prompt, updatedAt: new Date() })
    .where(eq(scheduledPosts.id, post.id));

  return res.json({ mediaUrl });
});

export { router as postsRouter };
