import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { subscriptions } from "../db/schema";
import { auth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { SubscribeSchema, UpdateOverageCapSchema } from "@anthyx/config";
import { stripe, createSubscription, handleStripeWebhook } from "../services/billing/stripe";
import { createPaystackSubscription, handlePaystackWebhook, cancelPaystackSubscription } from "../services/billing/paystack";
import { getCurrentUsage } from "../services/billing/usage-tracker";
import { PLAN_TIER_CONFIGS } from "@anthyx/types";
import { productConfig } from "@anthyx/config";

const router = Router();

// GET /billing/subscription
router.get("/subscription", auth, async (req, res) => {
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.organizationId, req.user.orgId),
  });
  if (!sub) return res.status(404).json({ error: "No subscription" });

  const usage = await getCurrentUsage(req.user.orgId);
  return res.json({ subscription: sub, usage });
});

// GET /billing/usage
router.get("/usage", auth, async (req, res) => {
  const usage = await getCurrentUsage(req.user.orgId);
  return res.json(usage);
});

// POST /billing/subscribe  — body: { tier, interval, provider? }
router.post("/subscribe", auth, validate(SubscribeSchema), async (req, res) => {
  const { tier, interval, provider = "paystack" } = req.body as { tier: string; interval: string; provider?: string };

  if (provider === "stripe") {
    const priceId = process.env[`STRIPE_PRICE_${tier.toUpperCase()}_${interval.toUpperCase()}`];
    if (!priceId) return res.status(400).json({ error: `No Stripe price configured for ${tier} ${interval}` });
    const { checkoutUrl } = await createSubscription({ organizationId: req.user.orgId, email: req.user.email, priceId });
    return res.json({ checkoutUrl, provider: "stripe" });
  }

  const planCode = process.env[`PAYSTACK_PLAN_${tier.toUpperCase()}_${interval.toUpperCase()}`];
  if (!planCode) return res.status(400).json({ error: `No Paystack plan configured for ${tier} ${interval}` });
  const { checkoutUrl } = await createPaystackSubscription({ organizationId: req.user.orgId, email: req.user.email, planCode });
  return res.json({ checkoutUrl, provider: "paystack" });
});

// POST /billing/upgrade
router.post("/upgrade", auth, validate(SubscribeSchema), async (req, res) => {
  const { tier, interval, provider = "paystack" } = req.body as { tier: string; interval: string; provider?: string };

  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.organizationId, req.user.orgId),
  });

  if (provider === "paystack" || sub?.billingProvider === "paystack") {
    const planCode = process.env[`PAYSTACK_PLAN_${tier.toUpperCase()}_${interval.toUpperCase()}`];
    if (!planCode) return res.status(400).json({ error: `No Paystack plan configured for ${tier} ${interval}` });
    const { checkoutUrl } = await createPaystackSubscription({ organizationId: req.user.orgId, email: req.user.email, planCode });
    return res.json({ checkoutUrl, provider: "paystack" });
  }

  const priceId = process.env[`STRIPE_PRICE_${tier.toUpperCase()}_${interval.toUpperCase()}`];
  if (!priceId) return res.status(400).json({ error: `No Stripe price configured for ${tier} ${interval}` });

  if (sub?.stripeSubscriptionId) {
    const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
    await stripe.subscriptions.update(sub.stripeSubscriptionId, {
      items: [{ id: stripeSub.items.data[0]!.id, price: priceId }],
      proration_behavior: "create_prorations",
    });
    return res.json({ upgraded: true });
  }

  const { checkoutUrl } = await createSubscription({ organizationId: req.user.orgId, email: req.user.email, priceId });
  return res.json({ checkoutUrl });
});

// POST /billing/downgrade
router.post("/downgrade", auth, validate(SubscribeSchema), async (req, res) => {
  const { tier, interval, provider = "paystack" } = req.body as { tier: string; interval: string; provider?: string };

  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.organizationId, req.user.orgId),
  });

  if (provider === "paystack" || sub?.billingProvider === "paystack") {
    const planCode = process.env[`PAYSTACK_PLAN_${tier.toUpperCase()}_${interval.toUpperCase()}`];
    if (!planCode) return res.status(400).json({ error: `No Paystack plan configured for ${tier} ${interval}` });
    const { checkoutUrl } = await createPaystackSubscription({ organizationId: req.user.orgId, email: req.user.email, planCode });
    return res.json({ checkoutUrl, provider: "paystack" });
  }

  const priceId = process.env[`STRIPE_PRICE_${tier.toUpperCase()}_${interval.toUpperCase()}`];
  if (!priceId) return res.status(400).json({ error: `No Stripe price configured` });

  if (sub?.stripeSubscriptionId) {
    const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
    await stripe.subscriptions.update(sub.stripeSubscriptionId, {
      items: [{ id: stripeSub.items.data[0]!.id, price: priceId }],
      proration_behavior: "none",
      billing_cycle_anchor: "unchanged",
    });
  }

  return res.json({ downgraded: true });
});

// POST /billing/cancel
router.post("/cancel", auth, async (req, res) => {
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.organizationId, req.user.orgId),
  });

  if (sub?.billingProvider === "paystack") {
    await cancelPaystackSubscription(req.user.orgId);
  } else if (sub?.stripeSubscriptionId) {
    await stripe.subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: true });
  }

  return res.json({ cancellationScheduled: true });
});

// GET /billing/invoices
router.get("/invoices", auth, async (req, res) => {
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.organizationId, req.user.orgId),
  });

  if (!sub?.stripeCustomerId) return res.json([]);

  const invoices = await stripe.invoices.list({
    customer: sub.stripeCustomerId,
    limit: 24,
  });

  return res.json(invoices.data);
});

// PUT /billing/overage-cap
router.put("/overage-cap", auth, validate(UpdateOverageCapSchema), async (req, res) => {
  await db
    .update(subscriptions)
    .set({ overageCapCents: req.body.overageCapCents, updatedAt: new Date() })
    .where(eq(subscriptions.organizationId, req.user.orgId));

  return res.json({ updated: true });
});

// POST /billing/webhook/stripe
router.post("/webhook/stripe", async (req, res) => {
  const sig = req.headers["stripe-signature"] as string;
  try {
    await handleStripeWebhook(req.body as Buffer, sig);
    return res.json({ received: true });
  } catch (err) {
    console.error("[Billing] Stripe webhook error:", err);
    return res.status(400).json({ error: "Webhook failed" });
  }
});

// POST /billing/webhook/paystack
router.post("/webhook/paystack", async (req, res) => {
  const sig = req.headers["x-paystack-signature"] as string;
  try {
    await handlePaystackWebhook(req.body as Buffer, sig);
    return res.json({ received: true });
  } catch (err) {
    console.error("[Billing] Paystack webhook error:", err);
    return res.status(400).json({ error: "Webhook failed" });
  }
});

export { router as billingRouter };
