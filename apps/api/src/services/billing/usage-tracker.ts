import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "../../db/client";
import { usageRecords, subscriptions, planTiers } from "../../db/schema";
import { notificationQueue } from "../../queue/client";

export async function incrementPost(organizationId: string): Promise<void> {
  const record = await getOrCreateCurrentRecord(organizationId);
  if (!record) return;

  const newCount = (record.postsPublished ?? 0) + 1;
  const included = record.postsIncluded ?? 0;

  await db
    .update(usageRecords)
    .set({
      postsPublished: newCount,
      postsOverage: Math.max(0, newCount - included),
      updatedAt: new Date(),
    })
    .where(eq(usageRecords.id, record.id));

  // Enqueue threshold alerts at 80% and 100% of monthly quota
  if (included > 0) {
    const pct = newCount / included;
    if (pct >= 1.0 && (record.postsPublished ?? 0) / included < 1.0) {
      await notificationQueue.add("usage-alert", {
        organizationId,
        type: "quota_reached",
        postsPublished: newCount,
        postsIncluded: included,
        thresholdPct: 100,
      });
    } else if (pct >= 0.8 && (record.postsPublished ?? 0) / included < 0.8) {
      await notificationQueue.add("usage-alert", {
        organizationId,
        type: "quota_warning",
        postsPublished: newCount,
        postsIncluded: included,
        thresholdPct: 80,
      });
    }
  }
}

async function getOrCreateCurrentRecord(organizationId: string) {
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.organizationId, organizationId),
  });

  if (!sub?.currentPeriodStart || !sub.currentPeriodEnd) return null;

  const existing = await db.query.usageRecords.findFirst({
    where: and(
      eq(usageRecords.organizationId, organizationId),
      gte(usageRecords.billingPeriodStart, sub.currentPeriodStart),
      lte(usageRecords.billingPeriodEnd, sub.currentPeriodEnd),
    ),
  });

  if (existing) return existing;

  const tier = await db.query.planTiers.findFirst({
    where: eq(planTiers.tier, sub.tier),
  });

  const [created] = await db
    .insert(usageRecords)
    .values({
      organizationId,
      billingPeriodStart: sub.currentPeriodStart,
      billingPeriodEnd: sub.currentPeriodEnd,
      postsPublished: 0,
      postsIncluded: tier?.maxPostsPerMonth ?? 15,
      accountsIncluded: tier?.maxSocialAccounts ?? 2,
      brandsIncluded: tier?.maxBrands ?? 1,
    })
    .returning();

  return created ?? null;
}

export async function getCurrentUsage(organizationId: string) {
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.organizationId, organizationId),
  });

  if (!sub?.currentPeriodStart || !sub.currentPeriodEnd) return null;

  return db.query.usageRecords.findFirst({
    where: and(
      eq(usageRecords.organizationId, organizationId),
      gte(usageRecords.billingPeriodStart, sub.currentPeriodStart),
    ),
  });
}
