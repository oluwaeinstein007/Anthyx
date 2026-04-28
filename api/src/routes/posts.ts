import { Router } from "express";
import { eq, and, inArray, type SQL } from "drizzle-orm";
import multer from "multer";
import { db } from "../db/client";
import { scheduledPosts, postAnalytics, abTests, postStatusLogs, brandProfiles } from "../db/schema";
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
const mediaUpload = multer({ dest: "/tmp/anthyx-uploads/", limits: { fileSize: 50 * 1024 * 1024 } });

// GET /posts — list all posts for the org
// Query params: status, platform, brandProfileId, limit, offset
router.get("/", auth, async (req, res) => {
  const { status, platform, brandProfileId, limit: limitStr, offset: offsetStr } = req.query as Record<string, string | undefined>;
  const limit = Math.min(parseInt(limitStr ?? "50"), 200);
  const offset = parseInt(offsetStr ?? "0");

  const filters: SQL[] = [eq(scheduledPosts.organizationId, req.user.orgId)];
  if (status) filters.push(eq(scheduledPosts.status, status as never));
  if (platform) filters.push(eq(scheduledPosts.platform, platform as never));
  if (brandProfileId) filters.push(eq(scheduledPosts.brandProfileId, brandProfileId));

  const posts = await db.query.scheduledPosts.findMany({
    where: and(...filters),
    orderBy: (p, { desc: d }) => [d(p.scheduledAt)],
    limit,
    offset,
  });

  const postIds = posts.map((p) => p.id);
  const analyticsData =
    postIds.length > 0
      ? await db.query.postAnalytics.findMany({
          where: inArray(postAnalytics.postId, postIds),
        })
      : [];

  return res.json({
    posts: posts.map((p) => ({
      ...p,
      analytics: analyticsData.find((a) => a.postId === p.id) ?? null,
    })),
    total: posts.length,
    limit,
    offset,
  });
});

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

  // Group by agentId and take first 5 per agent (manual posts have null agentId → key "manual")
  const byAgent = new Map<string, typeof posts>();
  for (const post of posts) {
    const key = post.agentId ?? "manual";
    const existing = byAgent.get(key) ?? [];
    if (existing.length < 5) existing.push(post);
    byAgent.set(key, existing);
  }

  return res.json(Object.fromEntries(byAgent));
});

// POST /posts/assist — AI content assistance (improve, proofread, reword, suggest)
router.post("/assist", auth, async (req, res) => {
  try {
    const { content, action, platform: plt } = req.body as {
      content: string;
      action?: string;
      platform?: string;
    };
    if (!content?.trim()) return res.status(400).json({ error: "content is required" });

    const { generateWithFallback, CLAUDE_HAIKU } = await import("../services/agent/llm-client");

    const instructions: Record<string, string> = {
      improve: "Improve the writing quality, engagement, and clarity of this social media post. Make it more compelling and shareable. Return only the improved post text, no preamble.",
      proofread: "Fix all grammar, spelling, and punctuation errors. Keep the meaning and tone identical. Return only the corrected text, no preamble.",
      reword: "Rewrite this post using different words and phrasing while keeping the same core message. Return only the reworded text, no preamble.",
      suggest: "Write 3 alternative versions of this post. Label them exactly 'Option 1:', 'Option 2:', 'Option 3:' — each on its own line. Each should have a different tone or angle.",
    };

    const instruction = instructions[action ?? "improve"] ?? instructions["improve"]!;
    const platformCtx = plt ? ` Optimize for ${plt}.` : "";

    const result = await generateWithFallback({
      systemPrompt: `You are an expert social media copywriter.${platformCtx} ${instruction}`,
      userMessage: content,
      claudeModel: CLAUDE_HAIKU,
      maxTokens: 1024,
    });

    return res.json({ result });
  } catch (err) {
    console.error("[posts/assist]", err);
    const msg = err instanceof Error ? err.message : "AI assist failed";
    return res.status(500).json({ error: msg });
  }
});

// POST /posts — manually create a post (no plan or agent required)
router.post("/", auth, async (req, res) => {
  const {
    brandProfileId,
    agentId: manualAgentId,
    platform,
    planId,
    contentText,
    contentType,
    contentHashtags,
    scheduledAt,
    mediaUrls,
  } = req.body as {
    brandProfileId: string;
    agentId?: string;
    platform: string;
    planId?: string;
    contentText: string;
    contentType?: string;
    contentHashtags?: string[];
    scheduledAt: string;
    mediaUrls?: string[];
  };

  if (!brandProfileId || !platform || !contentText?.trim() || !scheduledAt) {
    return res.status(400).json({ error: "brandProfileId, platform, contentText, and scheduledAt are required" });
  }

  const brand = await db.query.brandProfiles.findFirst({
    where: and(
      eq(brandProfiles.id, brandProfileId),
      eq(brandProfiles.organizationId, req.user.orgId),
    ),
  });
  if (!brand) return res.status(404).json({ error: "Brand not found" });

  const [post] = await db
    .insert(scheduledPosts)
    .values({
      organizationId: req.user.orgId,
      brandProfileId,
      agentId: manualAgentId ?? null,
      platform: platform as never,
      planId: planId ?? null,
      contentText: contentText.trim(),
      contentType: contentType ?? null,
      contentHashtags: contentHashtags ?? null,
      mediaUrls: mediaUrls ?? null,
      scheduledAt: new Date(scheduledAt),
      status: "pending_review",
    })
    .returning();

  const created = post!;
  await db.insert(postStatusLogs).values({
    postId: created.id,
    organizationId: req.user.orgId,
    actorId: req.user.id,
    fromStatus: "draft",
    toStatus: "pending_review",
    reason: "Manually created",
  });

  return res.status(201).json(created);
});

// PUT /posts/:id
router.put("/:id", auth, validate(UpdatePostSchema), async (req, res) => {
  const { scheduledAt, ...rest } = req.body as { scheduledAt?: string; contentText?: string; contentHashtags?: string[] };
  const [updated] = await db
    .update(scheduledPosts)
    .set({
      ...rest,
      ...(scheduledAt !== undefined && { scheduledAt: new Date(scheduledAt) }),
      updatedAt: new Date(),
    })
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
// Accepts pending_review and vetoed posts (allows un-vetoing a previously vetoed post).
router.post("/:id/approve", auth, requireLimit("post"), validate(ApprovePostSchema), async (req, res) => {

  const post = await db.query.scheduledPosts.findFirst({
    where: and(
      eq(scheduledPosts.id, req.params.id!),
      eq(scheduledPosts.organizationId, req.user.orgId),
    ),
  });
  if (!post) return res.status(404).json({ error: "Not found" });

  const allowedFromStatuses = ["pending_review", "vetoed"];
  if (!allowedFromStatuses.includes(post.status!)) {
    return res.status(400).json({ error: `Cannot approve a post with status '${post.status}'` });
  }

  const fromStatus = post.status!;

  await db
    .update(scheduledPosts)
    .set({
      status: "approved",
      reviewedBy: req.user.id,
      reviewedAt: new Date(),
      reviewNotes: req.body.reviewNotes ?? null,
      updatedAt: new Date(),
    })
    .where(eq(scheduledPosts.id, post.id));

  await db.insert(postStatusLogs).values({
    postId: post.id,
    organizationId: req.user.orgId,
    actorId: req.user.id,
    fromStatus,
    toStatus: "approved",
    reason: req.body.reviewNotes ?? null,
  });

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
    const fromStatus = post.status!;
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

    await db.insert(postStatusLogs).values({
      postId: post.id,
      organizationId: req.user.orgId,
      actorId: req.user.id,
      fromStatus,
      toStatus: "vetoed",
      reason: reason ?? null,
    });
  }

  return res.json({ vetoed: posts.length });
});

// POST /posts/:id/veto
// Accepts pending_review and approved posts (allows vetoing a previously approved post).
router.post("/:id/veto", auth, validate(VetoPostSchema), async (req, res) => {
  const post = await db.query.scheduledPosts.findFirst({
    where: and(
      eq(scheduledPosts.id, req.params.id!),
      eq(scheduledPosts.organizationId, req.user.orgId),
    ),
  });
  if (!post) return res.status(404).json({ error: "Not found" });

  const allowedFromStatuses = ["pending_review", "approved"];
  if (!allowedFromStatuses.includes(post.status!)) {
    return res.status(400).json({ error: `Cannot veto a post with status '${post.status}'` });
  }

  const fromStatus = post.status!;

  await db
    .update(scheduledPosts)
    .set({
      status: "vetoed",
      reviewedBy: req.user.id,
      reviewedAt: new Date(),
      reviewNotes: req.body.reason ?? null,
      updatedAt: new Date(),
    })
    .where(eq(scheduledPosts.id, post.id));

  await db.insert(postStatusLogs).values({
    postId: post.id,
    organizationId: req.user.orgId,
    actorId: req.user.id,
    fromStatus,
    toStatus: "vetoed",
    reason: req.body.reason ?? null,
  });

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

// GET /posts/:id/status-log — audit trail of status changes for a post
router.get("/:id/status-log", auth, async (req, res) => {
  const post = await db.query.scheduledPosts.findFirst({
    where: and(eq(scheduledPosts.id, req.params.id!), eq(scheduledPosts.organizationId, req.user.orgId)),
  });
  if (!post) return res.status(404).json({ error: "Not found" });

  const logs = await db.query.postStatusLogs.findMany({
    where: eq(postStatusLogs.postId, post.id),
    orderBy: (l, { desc }) => [desc(l.createdAt)],
  });

  return res.json(logs);
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

// POST /posts/ab-tests/:abTestId/promote — evaluate and promote A/B test winner
router.post("/ab-tests/:abTestId/promote", auth, async (req, res) => {
  const result = await evaluateAndPromoteWinner(req.params.abTestId!);
  return res.json(result);
});

// GET /posts/:id — get single post
router.get("/:id", auth, async (req, res) => {
  const post = await db.query.scheduledPosts.findFirst({
    where: and(eq(scheduledPosts.id, req.params.id!), eq(scheduledPosts.organizationId, req.user.orgId)),
  });
  if (!post) return res.status(404).json({ error: "Not found" });
  return res.json(post);
});

// POST /posts/:id/ab-test — generate a second content variant for A/B testing
router.post("/:id/ab-test", auth, async (req, res) => {
  try {
    const result = await generateAbVariants(req.params.id!, req.user.orgId);
    return res.status(201).json(result);
  } catch (err) {
    console.error("[ab-test]", err);
    const message = err instanceof Error ? err.message : "Failed to generate A/B variant";
    return res.status(500).json({ error: message });
  }
});

// POST /posts/:id/regenerate-image — regenerate AI image for a draft/pending post
router.post("/:id/regenerate-image", auth, async (req, res) => {
  try {
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
      contentText: post.contentText ?? "",
      suggestedMediaPrompt: prompt,
      assetTrack: "ai",
    });

    if (!mediaUrl) return res.status(500).json({ error: "Image generation returned no result" });

    await db
      .update(scheduledPosts)
      .set({ mediaUrls: [mediaUrl], suggestedMediaPrompt: prompt, updatedAt: new Date() })
      .where(eq(scheduledPosts.id, post.id));

    return res.json({ mediaUrl });
  } catch (err) {
    console.error("[regenerate-image]", err);
    const message = err instanceof Error ? err.message : "Image generation failed";
    return res.status(500).json({ error: message });
  }
});

// POST /posts/:id/upload-media — upload user-provided image/video as post media
router.post("/:id/upload-media", auth, mediaUpload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file provided" });

    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp", "video/mp4", "video/quicktime"];
    if (!allowed.includes(req.file.mimetype)) {
      return res.status(400).json({ error: "Unsupported file type. Allowed: JPEG, PNG, GIF, WebP, MP4, MOV" });
    }

    const post = await db.query.scheduledPosts.findFirst({
      where: and(
        eq(scheduledPosts.id, req.params.id!),
        eq(scheduledPosts.organizationId, req.user.orgId),
      ),
    });
    if (!post) return res.status(404).json({ error: "Not found" });

    const fs = await import("fs/promises");
    const buffer = await fs.readFile(req.file.path);
    await fs.unlink(req.file.path).catch(() => {});

    const { uploadBufferToCDN } = await import("../services/assets/cdn");
    const ext = req.file.mimetype.split("/")[1]!.replace("quicktime", "mov");
    const filename = `assets/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const mediaUrl = await uploadBufferToCDN(buffer, req.file.mimetype, filename);

    await db
      .update(scheduledPosts)
      .set({ mediaUrls: [mediaUrl], updatedAt: new Date() })
      .where(eq(scheduledPosts.id, post.id));

    return res.json({ mediaUrl });
  } catch (err) {
    console.error("[upload-media]", err);
    const message = err instanceof Error ? err.message : "Upload failed";
    return res.status(500).json({ error: message });
  }
});

export { router as postsRouter };
