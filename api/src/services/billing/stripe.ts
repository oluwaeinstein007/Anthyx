import Stripe from "stripe";
import { eq, and } from "drizzle-orm";
import { db } from "../../db/client";
import { subscriptions, organizations, users } from "../../db/schema";
import type { PlanTier } from "@anthyx/types";
import { productConfig } from "@anthyx/config";

export const stripe = new Stripe(process.env["STRIPE_SECRET_KEY"] ?? "", {
  apiVersion: "2024-12-18.acacia" as Stripe.LatestApiVersion,
});

const PRICE_ID_TO_TIER: Record<string, PlanTier> = {};

function loadPriceMap() {
  const envMap: Record<string, PlanTier> = {
    STRIPE_PRICE_STARTER_MONTHLY: "starter",
    STRIPE_PRICE_STARTER_ANNUAL: "starter",
    STRIPE_PRICE_GROWTH_MONTHLY: "growth",
    STRIPE_PRICE_GROWTH_ANNUAL: "growth",
    STRIPE_PRICE_AGENCY_MONTHLY: "agency",
    STRIPE_PRICE_AGENCY_ANNUAL: "agency",
    STRIPE_PRICE_SCALE_MONTHLY: "scale",
    STRIPE_PRICE_SCALE_ANNUAL: "scale",
  };
  for (const [envKey, tier] of Object.entries(envMap)) {
    const priceId = process.env[envKey];
    if (priceId) PRICE_ID_TO_TIER[priceId] = tier;
  }
}

loadPriceMap();

export async function createSubscription(params: {
  organizationId: string;
  email: string;
  priceId: string;
  trialDays?: number;
}): Promise<{ checkoutUrl: string }> {
  const customer = await stripe.customers.create({
    email: params.email,
    metadata: { organizationId: params.organizationId },
  });

  const session = await stripe.checkout.sessions.create({
    customer: customer.id,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: params.priceId, quantity: 1 }],
    subscription_data: params.trialDays
      ? { trial_period_days: params.trialDays }
      : undefined,
    success_url: `${productConfig.dashboardUrl}/billing?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${productConfig.dashboardUrl}/billing/upgrade?cancelled=true`,
    metadata: { organizationId: params.organizationId },
  });

  return { checkoutUrl: session.url! };
}

export async function handleStripeWebhook(rawBody: Buffer, signature: string): Promise<void> {
  const event = stripe.webhooks.constructEvent(
    rawBody,
    signature,
    process.env["STRIPE_WEBHOOK_SECRET"]!,
  );

  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutComplete(event.data.object as Stripe.Checkout.Session);
      break;
    case "customer.subscription.updated":
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionCancelled(event.data.object as Stripe.Subscription);
      break;
    case "invoice.payment_failed":
      await handlePaymentFailed(event.data.object as Stripe.Invoice);
      break;
  }
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const orgId = session.metadata?.organizationId;
  if (!orgId) return;

  const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
  const priceId = subscription.items.data[0]?.price.id ?? "";
  const tier = PRICE_ID_TO_TIER[priceId] ?? "starter";

  await db
    .update(subscriptions)
    .set({
      tier,
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      status: subscription.status,
      trialEndsAt: subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : null,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.organizationId, orgId));
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customer = await stripe.customers.retrieve(subscription.customer as string);
  const orgId = (customer as Stripe.Customer).metadata?.organizationId;
  if (!orgId) return;

  const priceId = subscription.items.data[0]?.price.id ?? "";
  const tier = PRICE_ID_TO_TIER[priceId];

  await db
    .update(subscriptions)
    .set({
      ...(tier ? { tier } : {}),
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelledAt: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000)
        : null,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.organizationId, orgId));
}

async function handleSubscriptionCancelled(subscription: Stripe.Subscription) {
  const customer = await stripe.customers.retrieve(subscription.customer as string);
  const orgId = (customer as Stripe.Customer).metadata?.organizationId;
  if (!orgId) return;

  await db
    .update(subscriptions)
    .set({
      tier: "sandbox",
      status: "cancelled",
      cancelledAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.organizationId, orgId));
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customer = await stripe.customers.retrieve(invoice.customer as string);
  const orgId = (customer as Stripe.Customer).metadata?.organizationId;
  if (!orgId) return;

  await db
    .update(subscriptions)
    .set({ status: "past_due", updatedAt: new Date() })
    .where(eq(subscriptions.organizationId, orgId));

  // Send dunning email
  const owner = await db.query.users.findFirst({
    where: and(eq(users.organizationId, orgId), eq(users.role, "owner")),
  });
  if (owner?.email) {
    const apiKey = process.env["RESEND_API_KEY"];
    const dashUrl = process.env["DASHBOARD_URL"] ?? "https://app.anthyx.com";
    if (apiKey) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          from: process.env["EMAIL_FROM"] ?? "billing@anthyx.com",
          to: [owner.email],
          subject: "Action required: payment failed",
          html: `<p>Hi ${owner.name ?? "there"},</p><p>We couldn't process your payment. Please update your payment method to avoid service interruption.</p><p><a href="${dashUrl}/billing">Update payment method →</a></p><p>If you need help, reply to this email.</p>`,
        }),
      }).catch((e) => console.error("[Dunning] Email failed:", e));
    }
  }
}
