import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db } from "../db/client";
import { conversionEvents } from "../db/schema";
import { auth } from "../middleware/auth";

const router = Router();

// POST /crm/conversions — ingest a conversion event from a CRM or pixel
router.post("/conversions", auth, async (req, res) => {
  const { utm_source, utm_medium, utm_campaign, utm_content, event_type, amount_cents, metadata } = req.body as {
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    event_type: string;
    amount_cents?: number;
    metadata?: Record<string, unknown>;
  };

  if (!event_type?.trim()) return res.status(400).json({ error: "event_type is required" });

  const [event] = await db.insert(conversionEvents).values({
    organizationId: req.user.orgId,
    utmSource: utm_source ?? null,
    utmMedium: utm_medium ?? null,
    utmCampaign: utm_campaign ?? null,
    utmContent: utm_content ?? null,
    eventType: event_type,
    amountCents: amount_cents ?? null,
    metadata: metadata ?? null,
    source: "webhook",
  }).returning();

  return res.status(201).json(event);
});

// GET /crm/conversions — list conversion events for the org
router.get("/conversions", auth, async (req, res) => {
  const { limit: limitStr, offset: offsetStr } = req.query as Record<string, string | undefined>;
  const limit = Math.min(parseInt(limitStr ?? "50"), 200);
  const offset = parseInt(offsetStr ?? "0");

  const events = await db.query.conversionEvents.findMany({
    where: eq(conversionEvents.organizationId, req.user.orgId),
    orderBy: [desc(conversionEvents.receivedAt)],
    limit,
    offset,
  });

  return res.json({ events, total: events.length, limit, offset });
});

// GET /crm/conversions/summary — revenue and count by campaign
router.get("/conversions/summary", auth, async (req, res) => {
  const events = await db.query.conversionEvents.findMany({
    where: eq(conversionEvents.organizationId, req.user.orgId),
  });

  const byCampaign: Record<string, { count: number; totalCents: number }> = {};
  let totalRevenueCents = 0;

  for (const ev of events) {
    const key = ev.utmCampaign ?? "(unattributed)";
    if (!byCampaign[key]) byCampaign[key] = { count: 0, totalCents: 0 };
    byCampaign[key]!.count++;
    byCampaign[key]!.totalCents += ev.amountCents ?? 0;
    totalRevenueCents += ev.amountCents ?? 0;
  }

  return res.json({
    totalConversions: events.length,
    totalRevenueCents,
    byCampaign,
  });
});

export { router as crmRouter };
