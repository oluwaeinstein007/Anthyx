import { createHmac } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { subscriptions } from "../../db/schema";
import type { PlanTier } from "@anthyx/types";
import { productConfig } from "@anthyx/config";

const PAYSTACK_BASE = "https://api.paystack.co";
const SECRET = process.env["PAYSTACK_SECRET_KEY"] ?? "";

async function paystackRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${SECRET}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const json = (await res.json()) as { status: boolean; data: T; message: string };
  if (!json.status) throw new Error(`Paystack error: ${json.message}`);
  return json.data;
}

// ── Plan code lookup ──────────────────────────────────────────────────────────

const PLAN_CODE_TO_TIER: Record<string, PlanTier> = {};

function loadPlanMap() {
  const envMap: Record<string, PlanTier> = {
    PAYSTACK_PLAN_STARTER_MONTHLY: "starter",
    PAYSTACK_PLAN_STARTER_ANNUAL: "starter",
    PAYSTACK_PLAN_GROWTH_MONTHLY: "growth",
    PAYSTACK_PLAN_GROWTH_ANNUAL: "growth",
    PAYSTACK_PLAN_AGENCY_MONTHLY: "agency",
    PAYSTACK_PLAN_AGENCY_ANNUAL: "agency",
    PAYSTACK_PLAN_SCALE_MONTHLY: "scale",
    PAYSTACK_PLAN_SCALE_ANNUAL: "scale",
  };
  for (const [envKey, tier] of Object.entries(envMap)) {
    const code = process.env[envKey];
    // Only register fully-formed plan codes (Paystack codes are PLN_ + 16 chars)
    if (code && code.length > 8) PLAN_CODE_TO_TIER[code] = tier;
  }
}

loadPlanMap();

export function isValidPlanCode(code: string | undefined): code is string {
  return typeof code === "string" && code.length > 8;
}

// ── Checkout ──────────────────────────────────────────────────────────────────

export async function createPaystackSubscription(params: {
  organizationId: string;
  email: string;
  planCode: string;
}): Promise<{ checkoutUrl: string }> {
  const data = await paystackRequest<{ authorization_url: string; reference: string }>(
    "POST",
    "/transaction/initialize",
    {
      email: params.email,
      amount: 0, // overridden by plan
      plan: params.planCode,
      callback_url: `${productConfig.dashboardUrl}/dashboard/billing?provider=paystack`,
      metadata: { organizationId: params.organizationId },
    },
  );

  return { checkoutUrl: data.authorization_url };
}

// ── Webhook ───────────────────────────────────────────────────────────────────

export function verifyPaystackSignature(rawBody: Buffer, signature: string): boolean {
  const hash = createHmac("sha512", SECRET).update(rawBody).digest("hex");
  return hash === signature;
}

export async function handlePaystackWebhook(rawBody: Buffer, signature: string): Promise<void> {
  if (!verifyPaystackSignature(rawBody, signature)) {
    throw new Error("Invalid Paystack webhook signature");
  }

  const event = JSON.parse(rawBody.toString()) as { event: string; data: Record<string, unknown> };

  switch (event.event) {
    case "subscription.create":
      await handleSubscriptionCreate(event.data);
      break;
    case "charge.success":
      await handleChargeSuccess(event.data);
      break;
    case "subscription.disable":
    case "subscription.not_renew":
      await handleSubscriptionDisable(event.data);
      break;
    case "invoice.payment_failed":
      await handleInvoiceFailed(event.data);
      break;
  }
}

// ── Verify transaction (called on redirect return) ────────────────────────────

export async function verifyPaystackTransaction(reference: string): Promise<void> {
  const data = await paystackRequest<Record<string, unknown>>("GET", `/transaction/verify/${reference}`);

  const status = data["status"] as string;
  if (status !== "success") throw new Error(`Payment not successful: ${status}`);

  const metadata = data["metadata"] as { organizationId?: string } | null;
  const orgId = metadata?.organizationId;
  if (!orgId) throw new Error("No organizationId in transaction metadata");

  const planCode = (data["plan"] as string | null) ?? "";
  const tier = PLAN_CODE_TO_TIER[planCode] ?? null;

  const customer = data["customer"] as { customer_code?: string } | null;

  await db
    .update(subscriptions)
    .set({
      ...(tier ? { tier } : {}),
      billingProvider: "paystack",
      paystackCustomerCode: customer?.customer_code ?? null,
      paystackPlanCode: planCode || null,
      status: "active",
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.organizationId, orgId));
}

// ── Cancel helper (called from billing route) ─────────────────────────────────

export async function cancelPaystackSubscription(organizationId: string): Promise<void> {
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.organizationId, organizationId),
  });

  if (!sub?.paystackSubscriptionCode || !sub.paystackEmailToken) return;

  await paystackRequest("POST", "/subscription/disable", {
    code: sub.paystackSubscriptionCode,
    token: sub.paystackEmailToken,
  });
}

// ── Webhook handlers ──────────────────────────────────────────────────────────

async function handleSubscriptionCreate(data: Record<string, unknown>) {
  const customer = data["customer"] as { metadata?: { organizationId?: string } } | null;
  const orgId = customer?.metadata?.organizationId;
  if (!orgId) return;

  const planCode = (data["plan"] as { plan_code?: string } | null)?.plan_code ?? "";
  const tier = PLAN_CODE_TO_TIER[planCode] ?? "starter";
  const nextPaymentDate = data["next_payment_date"] as string | null;

  await db
    .update(subscriptions)
    .set({
      tier,
      billingProvider: "paystack",
      paystackSubscriptionCode: data["subscription_code"] as string,
      paystackEmailToken: data["email_token"] as string,
      paystackPlanCode: planCode,
      status: "active",
      currentPeriodStart: new Date(),
      currentPeriodEnd: nextPaymentDate ? new Date(nextPaymentDate) : null,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.organizationId, orgId));
}

async function handleChargeSuccess(data: Record<string, unknown>) {
  const metadata = (data["metadata"] as { organizationId?: string } | null);
  const orgId = metadata?.organizationId;
  if (!orgId) return;

  const customer = data["customer"] as { customer_code?: string } | null;
  const planCode = (data["plan"] as string | null) ?? "";
  const tier = PLAN_CODE_TO_TIER[planCode] ?? null;

  await db
    .update(subscriptions)
    .set({
      paystackCustomerCode: customer?.customer_code ?? null,
      ...(tier ? { tier, billingProvider: "paystack", paystackPlanCode: planCode } : {}),
      status: "active",
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.organizationId, orgId));
}

async function handleSubscriptionDisable(data: Record<string, unknown>) {
  const customer = data["customer"] as { metadata?: { organizationId?: string } } | null;
  const orgId = customer?.metadata?.organizationId;
  if (!orgId) return;

  await db
    .update(subscriptions)
    .set({ tier: "sandbox", status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
    .where(eq(subscriptions.organizationId, orgId));
}

async function handleInvoiceFailed(data: Record<string, unknown>) {
  const subscription = data["subscription"] as { customer?: { metadata?: { organizationId?: string } } } | null;
  const orgId = subscription?.customer?.metadata?.organizationId;
  if (!orgId) return;

  await db
    .update(subscriptions)
    .set({ status: "past_due", updatedAt: new Date() })
    .where(eq(subscriptions.organizationId, orgId));
}
