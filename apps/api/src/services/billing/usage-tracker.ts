import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "../../db/client";
import { usageRecords, subscriptions, planTiers } from "../../db/schema";

export async function incrementPost(organizationId: string): Promise<void> {
  const record = await getOrCreateCurrentRecord(organizationId);
  if (!record) return;

  await db
    .update(usageRecords)
    .set({
      postsPublished: (record.postsPublished ?? 0) + 1,
      postsOverage: Math.max(
        0,
        (record.postsPublished ?? 0) + 1 - (record.postsIncluded ?? 0),
      ),
      updatedAt: new Date(),
    })
    .where(eq(usageRecords.id, record.id));
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
