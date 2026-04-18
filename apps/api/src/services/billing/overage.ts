import { eq, lte, and } from "drizzle-orm";
import { db } from "../../db/client";
import { usageRecords, subscriptions, planTiers } from "../../db/schema";
import { stripe } from "./stripe";

export async function calculateAndInvoiceOverage(usageRecordId: string): Promise<void> {
  const record = await db.query.usageRecords.findFirst({
    where: eq(usageRecords.id, usageRecordId),
  });

  if (!record || record.overageInvoiced) return;

  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.organizationId, record.organizationId),
  });

  if (!sub?.stripeCustomerId) return;

  const tier = await db.query.planTiers.findFirst({
    where: eq(planTiers.tier, sub.tier),
  });

  if (!tier) return;

  const postsOverage = Math.max(0, (record.postsPublished ?? 0) - (record.postsIncluded ?? 0));
  const accountsOverage = Math.max(0, (record.accountsConnected ?? 0) - (record.accountsIncluded ?? 0));
  const brandsOverage = Math.max(0, (record.brandsActive ?? 0) - (record.brandsIncluded ?? 0));

  const totalCents =
    postsOverage * tier.overagePricePerPost +
    accountsOverage * tier.overagePricePerAccount +
    brandsOverage * tier.overagePricePerBrand;

  if (totalCents <= 0) {
    await db
      .update(usageRecords)
      .set({ overageInvoiced: true, updatedAt: new Date() })
      .where(eq(usageRecords.id, usageRecordId));
    return;
  }

  const periodLabel = record.billingPeriodStart.toISOString().slice(0, 7);

  await stripe.invoiceItems.create({
    customer: sub.stripeCustomerId,
    amount: totalCents,
    currency: "usd",
    description: [
      `Overage for ${periodLabel}`,
      postsOverage > 0 ? `${postsOverage} extra post(s)` : null,
      accountsOverage > 0 ? `${accountsOverage} extra account(s)` : null,
      brandsOverage > 0 ? `${brandsOverage} extra brand(s)` : null,
    ]
      .filter(Boolean)
      .join(" · "),
    metadata: {
      usageRecordId,
      organizationId: record.organizationId,
      postsOverage: String(postsOverage),
      accountsOverage: String(accountsOverage),
      brandsOverage: String(brandsOverage),
    },
  });

  await db
    .update(usageRecords)
    .set({ overageCostCents: totalCents, overageInvoiced: true, updatedAt: new Date() })
    .where(eq(usageRecords.id, usageRecordId));

  console.log(`[Overage] Invoiced $${(totalCents / 100).toFixed(2)} for org ${record.organizationId}`);
}

export async function findAndInvoiceExpiredPeriods(): Promise<void> {
  const now = new Date();

  const expired = await db.query.usageRecords.findMany({
    where: and(
      lte(usageRecords.billingPeriodEnd, now),
      eq(usageRecords.overageInvoiced, false),
    ),
  });

  for (const record of expired) {
    try {
      await calculateAndInvoiceOverage(record.id);
    } catch (err) {
      console.error(`[Overage] Failed to invoice usage record ${record.id}:`, err);
    }
  }
}
