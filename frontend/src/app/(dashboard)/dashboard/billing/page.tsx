"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Link from "next/link";
import {
  CreditCard, ArrowRight, AlertTriangle, Clock,
  TrendingUp, Sparkles, Check, XCircle, RefreshCw,
} from "lucide-react";

interface Subscription {
  tier: string;
  status: string;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  overageCapCents: number;
  gracePeriodEndsAt?: string | null;
  accessUntil?: string | null;
}
interface Usage {
  postsPublished: number;
  postsIncluded: number;
  postsOverage: number;
  accountsConnected: number;
  accountsIncluded: number;
  brandsActive: number;
  brandsIncluded: number;
  overageCostCents: number;
}
interface BillingData {
  subscription: Subscription;
  usage: Usage | null;
}

const TIER_LABELS: Record<string, string> = {
  sandbox: "Sandbox (Free)",
  starter: "Starter",
  growth: "Growth",
  agency: "Agency",
  scale: "Scale",
  enterprise: "Enterprise",
};

const TIER_PRICES: Record<string, string> = {
  starter: "$49/mo",
  growth: "$149/mo",
  agency: "$399/mo",
  scale: "$999/mo",
};

const PLANS = [
  {
    tier: "starter",
    label: "Starter",
    price: "$49",
    interval: "month",
    features: ["1 brand", "3 social accounts", "150 posts/mo", "Email support"],
  },
  {
    tier: "growth",
    label: "Growth",
    price: "$149",
    interval: "month",
    features: ["3 brands", "10 social accounts", "500 posts/mo", "Feedback loop", "Priority support"],
    highlight: true,
  },
  {
    tier: "agency",
    label: "Agency",
    price: "$399",
    interval: "month",
    features: ["10 brands", "Unlimited accounts", "Unlimited posts", "CSV reports", "White-label", "Dedicated support"],
  },
];

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="space-y-4 animate-pulse max-w-2xl"><div className="h-8 bg-gray-200 rounded-lg w-32" /><div className="h-40 bg-gray-100 rounded-2xl" /></div>}>
      <BillingPageContent />
    </Suspense>
  );
}

function BillingPageContent() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const provider = searchParams.get("provider");
    const reference = searchParams.get("reference") ?? searchParams.get("trxref");
    if (provider !== "paystack" || !reference) return;

    api.get(`/billing/verify/paystack?reference=${reference}`)
      .then(() => qc.invalidateQueries({ queryKey: ["billing"] }))
      .catch(console.error)
      .finally(() => {
        router.replace("/dashboard/billing");
      });
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const { data, isLoading, error } = useQuery<BillingData>({
    queryKey: ["billing"],
    queryFn: () => api.get<BillingData>("/billing/subscription"),
    retry: false,
  });

  const cancel = useMutation({
    mutationFn: () => api.post("/billing/cancel"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["billing"] }),
  });

  const subscribe = useMutation({
    mutationFn: ({ tier, interval }: { tier: string; interval: string }) =>
      api.post<{ checkoutUrl: string }>("/billing/subscribe", { tier, interval }),
    onSuccess: (res) => {
      if (res.checkoutUrl) window.location.href = res.checkoutUrl;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse max-w-2xl">
        <div className="h-8 bg-gray-200 rounded-lg w-32" />
        <div className="h-40 bg-gray-100 rounded-2xl" />
        <div className="h-48 bg-gray-100 rounded-2xl" />
      </div>
    );
  }

  const noSubscription = !!error || !data;

  if (noSubscription) {
    return (
      <div className="space-y-8 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
          <p className="text-sm text-gray-500 mt-1">Choose a plan to unlock your full content engine.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {PLANS.map((plan) => (
            <div
              key={plan.tier}
              className={`bg-white rounded-2xl p-6 border flex flex-col gap-5 ${
                plan.highlight
                  ? "border-green-400 shadow-lg shadow-green-50 ring-2 ring-green-400 ring-opacity-30"
                  : "border-gray-200"
              }`}
            >
              {plan.highlight && (
                <span className="self-start text-xs font-semibold bg-green-600 text-white px-2.5 py-0.5 rounded-full">
                  Most popular
                </span>
              )}
              <div>
                <p className="text-xs text-gray-400 mb-1">{plan.label}</p>
                <div className="flex items-end gap-1">
                  <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                  <span className="text-sm text-gray-400 mb-1">/{plan.interval}</span>
                </div>
              </div>
              <ul className="space-y-2 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                    <Check className="w-4 h-4 text-green-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => subscribe.mutate({ tier: plan.tier, interval: "monthly" })}
                disabled={subscribe.isPending}
                className={`w-full py-2.5 text-sm font-medium rounded-xl transition-colors ${
                  plan.highlight
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : "border border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
              >
                {subscribe.isPending ? "Redirecting…" : "Get started"}
              </button>
            </div>
          ))}
        </div>

        <p className="text-xs text-center text-gray-400">
          All plans include a 14-day free trial. No credit card required to start.
        </p>
      </div>
    );
  }

  const { subscription: sub, usage } = data;
  const isTrial = sub.status === "trialing" && sub.trialEndsAt && new Date(sub.trialEndsAt) > new Date();
  const isGracePeriod = sub.status === "grace_period";
  const isSuspended = sub.status === "suspended";

  const graceDaysLeft = isGracePeriod && sub.gracePeriodEndsAt
    ? Math.max(0, Math.ceil((new Date(sub.gracePeriodEndsAt).getTime() - Date.now()) / 86_400_000))
    : null;

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your plan and usage.</p>
      </div>

      {/* Suspended state — full-width alert */}
      {isSuspended && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-base font-bold text-red-900">Subscription suspended</p>
              <p className="text-sm text-red-700 mt-1">
                All scheduled posts are paused. Your data is safe — reactivate to resume posting immediately.
              </p>
            </div>
          </div>
          <button
            onClick={() => subscribe.mutate({ tier: sub.tier === "sandbox" ? "starter" : sub.tier, interval: "monthly" })}
            disabled={subscribe.isPending}
            className="self-start inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
          >
            <RefreshCw className="w-4 h-4" />
            {subscribe.isPending ? "Redirecting…" : "Reactivate subscription"}
          </button>
        </div>
      )}

      {/* Grace period alert */}
      {isGracePeriod && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-3">
          <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-900">
              Grace period — {graceDaysLeft !== null ? `${graceDaysLeft} day${graceDaysLeft !== 1 ? "s" : ""} remaining` : "active"}
            </p>
            <p className="text-sm text-amber-700 mt-0.5">
              Payment failed. New posts are paused. Update your payment method before the grace period ends to avoid suspension.
            </p>
          </div>
        </div>
      )}

      {/* Current plan card */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center shrink-0">
                <CreditCard className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Current plan</p>
                <p className="text-lg font-bold text-gray-900">{TIER_LABELS[sub.tier] ?? sub.tier}</p>
                {TIER_PRICES[sub.tier] && (
                  <p className="text-sm text-gray-500">{TIER_PRICES[sub.tier]}</p>
                )}
              </div>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
              sub.status === "active" || sub.status === "trialing"
                ? "bg-green-100 text-green-700"
                : sub.status === "grace_period"
                ? "bg-amber-100 text-amber-700"
                : "bg-red-100 text-red-700"
            }`}>
              {sub.status === "grace_period" ? "Grace period" : sub.status}
            </span>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          {isTrial && (
            <div className="flex items-start gap-2.5 p-3.5 bg-blue-50 border border-blue-200 rounded-xl">
              <Clock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-800">Trial ends {new Date(sub.trialEndsAt!).toLocaleDateString()}</p>
                <p className="text-xs text-blue-600 mt-0.5">Add a payment method to keep your access after the trial.</p>
              </div>
            </div>
          )}

          {sub.currentPeriodEnd && !isSuspended && (
            <p className="text-xs text-gray-400">
              {sub.status === "cancelled" ? "Access until" : "Next renewal"}:{" "}
              {new Date(sub.currentPeriodEnd).toLocaleDateString()}
            </p>
          )}

          {!isSuspended && (
            <Link
              href="/dashboard/billing/upgrade"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <Sparkles className="w-4 h-4" /> Upgrade plan <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>

      {/* Usage meters */}
      {usage && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-2.5">
            <TrendingUp className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900">Usage this period</h2>
          </div>
          <UsageMeter label="Posts published" used={usage.postsPublished} included={usage.postsIncluded} overage={usage.postsOverage} />
          <UsageMeter label="Social accounts" used={usage.accountsConnected} included={usage.accountsIncluded} />
          <UsageMeter label="Brand profiles" used={usage.brandsActive} included={usage.brandsIncluded} />

          {usage.overageCostCents > 0 && (
            <div className="flex items-start gap-2.5 p-3.5 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  Overage this period: ${(usage.overageCostCents / 100).toFixed(2)}
                </p>
                <p className="text-xs text-amber-600 mt-0.5">Will be invoiced at end of billing period.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Danger zone */}
      {sub.tier !== "sandbox" && !isSuspended && (
        <div className="bg-white border border-red-200 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-red-700 mb-2">Cancel subscription</h2>
          <p className="text-sm text-gray-500 mb-4">
            Your access continues until end of the current billing period. You&apos;ll be downgraded to Sandbox.
          </p>
          <button
            onClick={() => cancel.mutate()}
            disabled={cancel.isPending}
            className="px-4 py-2.5 text-sm text-red-600 border border-red-200 rounded-xl hover:bg-red-50 disabled:opacity-50 transition-colors font-medium"
          >
            {cancel.isPending ? "Cancelling…" : "Cancel at period end"}
          </button>
        </div>
      )}
    </div>
  );
}

function UsageMeter({ label, used, included, overage = 0 }: { label: string; used: number; included: number; overage?: number }) {
  const pct = included > 0 ? Math.min(100, (used / included) * 100) : 0;
  const overLimit = used > included && included !== -1;
  const barColor = overLimit ? "bg-red-500" : pct > 80 ? "bg-amber-500" : "bg-green-500";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">{label}</span>
        <span className={`text-sm font-medium ${overLimit ? "text-red-600" : "text-gray-700"}`}>
          {used} / {included === -1 ? "∞" : included}
          {overage > 0 && <span className="text-red-500 text-xs ml-1">(+{overage})</span>}
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
