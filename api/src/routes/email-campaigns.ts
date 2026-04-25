import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { createRequire } from "module";
import path from "path";
import { pathToFileURL } from "url";
import { db } from "../db/client";
import { emailCampaigns, brandProfiles, socialAccounts } from "../db/schema";
import { auth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { CreateEmailCampaignSchema } from "@anthyx/config";
import { decryptToken } from "../services/oauth-proxy/crypto";

let _smcpRoot: string | undefined;
function smcpDistRoot(): string {
  if (!_smcpRoot) {
    const req = createRequire(__filename);
    _smcpRoot = path.dirname(req.resolve("social-mcp"));
  }
  return _smcpRoot!;
}

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

// POST /email-campaigns/:id/send — send immediately via social-mcp EmailService
router.post("/:id/send", auth, async (req, res) => {
  const { socialAccountId } = req.body as { socialAccountId?: string };

  const [campaign, emailAccount] = await Promise.all([
    db.query.emailCampaigns.findFirst({
      where: and(
        eq(emailCampaigns.id, req.params.id!),
        eq(emailCampaigns.organizationId, req.user.orgId),
      ),
    }),
    db.query.socialAccounts.findFirst({
      where: and(
        eq(socialAccounts.organizationId, req.user.orgId),
        eq(socialAccounts.platform, "email" as any),
        eq(socialAccounts.isActive, true),
        ...(socialAccountId ? [eq(socialAccounts.id, socialAccountId)] : []),
      ),
    }),
  ]);

  if (!campaign) return res.status(404).json({ error: "Not found" });
  if (campaign.status === "sent") return res.status(400).json({ error: "Already sent" });
  if (!campaign.recipientList?.length) {
    return res.status(400).json({ error: "No recipients configured" });
  }
  if (!emailAccount) {
    return res.status(400).json({
      error: "No active email account found. Configure one at Settings → Accounts → Email.",
    });
  }

  const cfg = emailAccount.platformConfig as Record<string, unknown>;
  const mailer = cfg["mailer"] as "smtp" | "sendgrid" | "mailgun";
  const fromAddress = cfg["fromAddress"] as string;
  const fromName = cfg["fromName"] as string | undefined;
  const decryptedSecret = decryptToken(emailAccount.accessToken!);

  // Load EmailService from social-mcp — credentials passed directly to constructor,
  // no config patching or mutex needed (each instance is fully isolated).
  const svcUrl = pathToFileURL(
    path.join(smcpDistRoot(), "services/email-service.js"),
  ).href;
  const { EmailService } = (await import(svcUrl)) as {
    EmailService: new (creds: object) => {
      send(to: string, subject: string, text: string, html?: string): Promise<void>;
    };
  };

  const service = new EmailService({
    mailer,
    fromAddress,
    fromName: fromName || undefined,
    smtpHost: cfg["host"] as string | undefined,
    smtpPort: cfg["port"] as number | undefined,
    smtpUsername: cfg["username"] as string | undefined,
    smtpPassword: mailer === "smtp" ? decryptedSecret : undefined,
    smtpEncryption: cfg["encryption"] as string | undefined,
    sendgridApiKey: mailer === "sendgrid" ? decryptedSecret : undefined,
    mailgunApiKey: mailer === "mailgun" ? decryptedSecret : undefined,
    mailgunDomain: cfg["domain"] as string | undefined,
  });

  // Send to each recipient separately — prevents address leakage across recipients
  await Promise.all(
    campaign.recipientList.map((to) =>
      service.send(
        to,
        campaign.subject,
        campaign.plainText ?? "",
        campaign.htmlBody,
      ),
    ),
  );

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
