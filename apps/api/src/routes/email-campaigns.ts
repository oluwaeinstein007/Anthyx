import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../db/client";
import { emailCampaigns, brandProfiles } from "../db/schema";
import { auth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { CreateEmailCampaignSchema } from "@anthyx/config";

const router = Router();

// GET /email-campaigns
router.get("/", auth, async (req, res) => {
  const { brandProfileId } = req.query as { brandProfileId?: string };

  const campaigns = await db.query.emailCampaigns.findMany({
    where: and(
      eq(emailCampaigns.organizationId, req.user.orgId),
      ...(brandProfileId ? [eq(emailCampaigns.brandProfileId, brandProfileId)] : []),
    ),
    orderBy: [desc(emailCampaigns.createdAt)],
  });

  return res.json(campaigns);
});

// GET /email-campaigns/:id
router.get("/:id", auth, async (req, res) => {
  const campaign = await db.query.emailCampaigns.findFirst({
    where: and(
      eq(emailCampaigns.id, req.params.id!),
      eq(emailCampaigns.organizationId, req.user.orgId),
    ),
  });
  if (!campaign) return res.status(404).json({ error: "Not found" });
  return res.json(campaign);
});

// POST /email-campaigns — create draft
router.post("/", auth, validate(CreateEmailCampaignSchema), async (req, res) => {
  const { brandProfileId, subject, previewText, htmlBody, plainText, recipientList, scheduledAt } = req.body;

  if (brandProfileId) {
    const brand = await db.query.brandProfiles.findFirst({
      where: and(
        eq(brandProfiles.id, brandProfileId),
        eq(brandProfiles.organizationId, req.user.orgId),
      ),
    });
    if (!brand) return res.status(404).json({ error: "Brand not found" });
  }

  const [campaign] = await db
    .insert(emailCampaigns)
    .values({
      organizationId: req.user.orgId,
      brandProfileId: brandProfileId ?? null,
      subject,
      previewText: previewText ?? null,
      htmlBody,
      plainText: plainText ?? null,
      recipientList,
      status: scheduledAt ? "scheduled" : "draft",
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    })
    .returning();

  return res.status(201).json(campaign);
});

// PATCH /email-campaigns/:id — update draft
router.patch("/:id", auth, async (req, res) => {
  const campaign = await db.query.emailCampaigns.findFirst({
    where: and(
      eq(emailCampaigns.id, req.params.id!),
      eq(emailCampaigns.organizationId, req.user.orgId),
    ),
  });
  if (!campaign) return res.status(404).json({ error: "Not found" });
  if (campaign.status === "sent") return res.status(400).json({ error: "Cannot edit a sent campaign" });

  const { subject, previewText, htmlBody, plainText, recipientList, scheduledAt } = req.body as {
    subject?: string;
    previewText?: string;
    htmlBody?: string;
    plainText?: string;
    recipientList?: string[];
    scheduledAt?: string | null;
  };

  const [updated] = await db
    .update(emailCampaigns)
    .set({
      ...(subject !== undefined && { subject }),
      ...(previewText !== undefined && { previewText }),
      ...(htmlBody !== undefined && { htmlBody }),
      ...(plainText !== undefined && { plainText }),
      ...(recipientList !== undefined && { recipientList }),
      ...(scheduledAt !== undefined && { scheduledAt: scheduledAt ? new Date(scheduledAt) : null }),
    })
    .where(eq(emailCampaigns.id, campaign.id))
    .returning();

  return res.json(updated);
});

// POST /email-campaigns/:id/send — send immediately via social-mcp EMAIL_SEND_BULK
router.post("/:id/send", auth, async (req, res) => {
  const campaign = await db.query.emailCampaigns.findFirst({
    where: and(
      eq(emailCampaigns.id, req.params.id!),
      eq(emailCampaigns.organizationId, req.user.orgId),
    ),
  });
  if (!campaign) return res.status(404).json({ error: "Not found" });
  if (campaign.status === "sent") return res.status(400).json({ error: "Already sent" });
  if (!campaign.recipientList || campaign.recipientList.length === 0) {
    return res.status(400).json({ error: "No recipients configured" });
  }

  // TODO: call email_send_bulk tool on the FastMCP server (social-mcp EMAIL_SEND_BULK)
  // with campaign.subject, campaign.htmlBody, campaign.plainText, campaign.recipientList

  await db
    .update(emailCampaigns)
    .set({ status: "sent", sentAt: new Date() })
    .where(eq(emailCampaigns.id, campaign.id));

  return res.json({ sent: true, recipients: campaign.recipientList.length });
});

// DELETE /email-campaigns/:id
router.delete("/:id", auth, async (req, res) => {
  const campaign = await db.query.emailCampaigns.findFirst({
    where: and(
      eq(emailCampaigns.id, req.params.id!),
      eq(emailCampaigns.organizationId, req.user.orgId),
    ),
  });
  if (!campaign) return res.status(404).json({ error: "Not found" });
  if (campaign.status === "sent") return res.status(400).json({ error: "Cannot delete a sent campaign" });

  await db.delete(emailCampaigns).where(eq(emailCampaigns.id, campaign.id));
  return res.json({ deleted: true });
});

export { router as emailCampaignsRouter };
