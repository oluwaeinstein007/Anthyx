import { Router } from "express";
import { eq, and, count } from "drizzle-orm";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { db } from "../db/client";
import { users, workflowParticipants, planTiers, subscriptions } from "../db/schema";
import { auth } from "../middleware/auth";
import { issueToken } from "../middleware/auth";

const router = Router();

const InviteSchema = z.object({
  email: z.string().email(),
  stage: z.enum(["plan_review", "hitl", "legal_review", "analytics_only"]),
  brandProfileId: z.string().uuid().optional(),
  agentId: z.string().uuid().optional(),
  canEdit: z.boolean().default(false),
  canVeto: z.boolean().default(false),
  notifyOn: z.array(z.string()).default([]),
});

const UpdateParticipantSchema = z.object({
  stage: z.enum(["plan_review", "hitl", "legal_review", "analytics_only"]).optional(),
  brandProfileId: z.string().uuid().nullable().optional(),
  agentId: z.string().uuid().nullable().optional(),
  canEdit: z.boolean().optional(),
  canVeto: z.boolean().optional(),
  notifyOn: z.array(z.string()).optional(),
});

// GET /team — list all participants for this org
router.get("/", auth, async (req, res) => {
  const participants = await db.query.workflowParticipants.findMany({
    where: eq(workflowParticipants.organizationId, req.user.orgId),
  });
  return res.json(participants);
});

// POST /team/invite — issue a signed invite token and create participant on accept
router.post("/invite", auth, async (req, res) => {
  const parsed = InviteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });

  const { email, stage, brandProfileId, agentId, canEdit, canVeto, notifyOn } = parsed.data;

  // Check seat limit against plan tier
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.organizationId, req.user.orgId),
  });
  const tier = sub ? await db.query.planTiers.findFirst({ where: eq(planTiers.tier, sub.tier) }) : null;

  if (tier?.maxTeamMembers && tier.maxTeamMembers > 0) {
    const seatResult = await db
      .select({ value: count() })
      .from(workflowParticipants)
      .where(eq(workflowParticipants.organizationId, req.user.orgId));
    const currentSeats = seatResult[0]?.value ?? 0;

    if (currentSeats >= tier.maxTeamMembers) {
      return res.status(402).json({
        error: "Seat limit reached",
        maxTeamMembers: tier.maxTeamMembers,
        message: `Your plan allows ${tier.maxTeamMembers} team member(s). Upgrade to add more.`,
      });
    }
  }

  const secret = process.env["JWT_SECRET"];
  if (!secret) return res.status(500).json({ error: "JWT_SECRET not configured" });

  // Invite token encodes all participant params — valid for 7 days
  const inviteToken = jwt.sign(
    {
      type: "invite",
      organizationId: req.user.orgId,
      invitedBy: req.user.id,
      email,
      stage,
      brandProfileId: brandProfileId ?? null,
      agentId: agentId ?? null,
      canEdit,
      canVeto,
      notifyOn,
    },
    secret,
    { expiresIn: "7d" },
  );

  return res.json({
    inviteToken,
    inviteUrl: `${process.env["DASHBOARD_URL"] ?? "http://localhost:3000"}/accept-invite?token=${inviteToken}`,
    expiresIn: "7 days",
  });
});

// POST /team/accept — accept an invite token, create or link user + participant row
router.post("/accept", async (req, res) => {
  const { token, password, name } = req.body as { token: string; password?: string; name?: string };
  if (!token) return res.status(400).json({ error: "token required" });

  const secret = process.env["JWT_SECRET"];
  if (!secret) return res.status(500).json({ error: "JWT_SECRET not configured" });

  let payload: {
    type: string;
    organizationId: string;
    email: string;
    stage: "plan_review" | "hitl" | "legal_review" | "analytics_only";
    brandProfileId: string | null;
    agentId: string | null;
    canEdit: boolean;
    canVeto: boolean;
    notifyOn: string[];
  };

  try {
    payload = jwt.verify(token, secret) as typeof payload;
  } catch {
    return res.status(400).json({ error: "Invalid or expired invite token" });
  }

  if (payload.type !== "invite") return res.status(400).json({ error: "Invalid token type" });

  // Find or create user
  let user = await db.query.users.findFirst({ where: eq(users.email, payload.email) });

  if (!user) {
    if (!password || !name) {
      return res.status(400).json({ error: "New users must provide name and password" });
    }
    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.default.hash(password, 12);
    [user] = await db
      .insert(users)
      .values({
        organizationId: payload.organizationId,
        email: payload.email,
        name,
        passwordHash,
        role: "member",
      })
      .returning();
  }

  if (!user) return res.status(500).json({ error: "Failed to create user" });

  // Create participant row
  const [participant] = await db
    .insert(workflowParticipants)
    .values({
      organizationId: payload.organizationId,
      userId: user.id,
      brandProfileId: payload.brandProfileId ?? null,
      agentId: payload.agentId ?? null,
      stage: payload.stage,
      canEdit: payload.canEdit,
      canVeto: payload.canVeto,
      notifyOn: payload.notifyOn,
    })
    .returning();

  const authToken = issueToken({
    id: user.id,
    email: user.email,
    orgId: payload.organizationId,
    role: user.role,
  });

  res.cookie("auth_token", authToken, {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return res.status(201).json({ participant, user: { id: user.id, email: user.email } });
});

// PATCH /team/:participantId — reassign stage, update permissions
router.patch("/:participantId", auth, async (req, res) => {
  const parsed = UpdateParticipantSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Validation failed" });

  const [updated] = await db
    .update(workflowParticipants)
    .set(parsed.data as Partial<typeof workflowParticipants.$inferInsert>)
    .where(
      and(
        eq(workflowParticipants.id, req.params.participantId!),
        eq(workflowParticipants.organizationId, req.user.orgId),
      ),
    )
    .returning();

  if (!updated) return res.status(404).json({ error: "Not found" });
  return res.json(updated);
});

// DELETE /team/:participantId — revoke access
router.delete("/:participantId", auth, async (req, res) => {
  await db
    .delete(workflowParticipants)
    .where(
      and(
        eq(workflowParticipants.id, req.params.participantId!),
        eq(workflowParticipants.organizationId, req.user.orgId),
      ),
    );
  return res.json({ revoked: true });
});

export { router as teamRouter };
