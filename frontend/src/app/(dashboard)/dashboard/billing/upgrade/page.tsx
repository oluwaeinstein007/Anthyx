"use client";

import { Suspense, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PLAN_TIER_CONFIGS } from "@anthyx/types";
import { useSearchParams } from "next/navigation";
import { Check, Zap, Tag, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

interface PromoValidation {
  valid: boolean;
  discountType: string;
  discountValue: number;
  applicableTiers: string[] | null;
}

function PromoCodeInput({ tier, onApplied }: { tier: string | null; onApplied: (promo: PromoValidation | null) => void }) {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<PromoValidation | null>(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  async function handleApply() {
    if (!code.trim()) return;
    setChecking(true);
    setError("");
    setResult(null);
    try {
      const r = await api.post<PromoValidation>("/billing/validate-promo", { code: code.trim(), tier: tier ?? undefined });
      setResult(r);
      onApplied(r);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Invalid code";
      setError(msg);
      onApplied(null);
    } finally {
      setChecking(false);
    }
  }

  function handleClear() {
    setCode("");
    setResult(null);
    setError("");
    onApplied(null);
  }

  const discountLabel = result
    ? result.discountType === "percent"
      ? `${result.discountValue}% off`
      : `$${(result.discountValue / 100).toFixed(2)} off`
    : null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Promo code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleApply()}
            disabled={!!result}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 disabled:bg-gray-50 disabled:text-gray-400 font-mono uppercase"
          />
        </div>
        {result ? (
          <button onClick={handleClear} className="flex items-center gap-1 px-3 py-2 text-sm text-red-500 hover:text-red-700 transition-colors">
            <XCircle className="w-4 h-4" /> Remove
          </button>
        ) : (
          <button
            onClick={handleApply}
            disabled={!code.trim() || checking}
            className="px-4 py-2 text-sm bg-gray-900 hover:bg-gray-800 text-white rounded-xl disabled:opacity-50 font-medium transition-colors"
          >
            {checking ? "Checking…" : "Apply"}
          </button>
        )}
      </div>
      {result && (
        <div className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
          <CheckCircle2 className="w-4 h-4" />
          Code applied — {discountLabel}
        </div>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}

const UPGRADEABLE_TIERS = ["starter", "growth", "agency", "scale"] as const;
const TIER_ORDER = { sandbox: 0, starter: 1, growth: 2, agency: 3, scale: 4, enterprise: 5 };

function UpgradePageInner() {
  const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">("monthly");
  const [appliedPromo, setAppliedPromo] = useState<PromoValidation | null>(null);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [downgradeBlockers, setDowngradeBlockers] = useState<string[]>([]);
  const searchParams = useSearchParams();
  const cancelled = searchParams.get("cancelled");

  const { data: billingData } = useQuery<{ subscription: { tier: string } }>({
    queryKey: ["billing"],
    queryFn: () => api.get("/billing/subscription"),
    retry: false,
  });
  const currentTier = billingData?.subscription?.tier ?? "sandbox";

  const subscribe = useMutation({
    mutationFn: ({ tier, interval }: { tier: string; interval: string }) => {
      const currentRank = TIER_ORDER[currentTier as keyof typeof TIER_ORDER] ?? 0;
      const newRank = TIER_ORDER[tier as keyof typeof TIER_ORDER] ?? 0;
      const endpoint = newRank < currentRank ? "/billing/downgrade" : "/billing/subscribe";
      return api.post<{ checkoutUrl?: string; downgraded?: boolean }>(endpoint, {
        tier,
        interval,
        provider: "paystack",
      });
    },
    onSuccess: (data) => {
      if (data.checkoutUrl) window.location.href = data.checkoutUrl;
      if (data.downgraded) window.location.href = "/dashboard/billing";
    },
    onError: (err: Error & { response?: { data?: { blockers?: string[] } } }) => {
      const blockers = err?.response?.data?.blockers;
      if (blockers?.length) setDowngradeBlockers(blockers);
    },
  });

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Choose your plan</h1>
        {cancelled && (
          <p className="text-sm text-amber-600 mt-1">Checkout was cancelled. No charges were made.</p>
        )}
        <p className="text-sm text-gray-500 mt-1">Scale your marketing with the right plan for your team.</p>
      </div>

      {/* Downgrade blockers */}
      {downgradeBlockers.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <div className="flex items-start gap-3 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm font-semibold text-amber-900">
              Downgrade blocked — resolve the following before proceeding:
            </p>
          </div>
          <ul className="space-y-2 pl-8">
            {downgradeBlockers.map((b, i) => (
              <li key={i} className="text-sm text-amber-800 list-disc">{b}</li>
            ))}
          </ul>
          <button
            onClick={() => setDowngradeBlockers([])}
            className="mt-3 text-xs text-amber-600 underline underline-offset-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Billing toggle */}
      <div className="inline-flex items-center gap-1 p-1 bg-gray-100 rounded-xl">
        <button
          onClick={() => setBillingInterval("monthly")}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            billingInterval === "monthly"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Monthly
        </button>
        <button
          onClick={() => setBillingInterval("annual")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            billingInterval === "annual"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Annual
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">20% off</span>
        </button>
      </div>

      {/* Plan cards */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {UPGRADEABLE_TIERS.map((tier) => {
          const config = PLAN_TIER_CONFIGS[tier];
          const price = billingInterval === "annual" ? config.annualPrice : config.monthlyPrice;
          const isPopular = tier === "growth";

          const features: string[] = [
            `${config.maxBrands === -1 ? "Unlimited" : config.maxBrands} brand${config.maxBrands !== 1 ? "s" : ""}`,
            `${config.maxAgents === -1 ? "Unlimited" : config.maxAgents} agent${config.maxAgents !== 1 ? "s" : ""}`,
            `${config.maxSocialAccounts === -1 ? "Unlimited" : config.maxSocialAccounts} accounts`,
            `${config.maxPostsPerMonth === -1 ? "Unlimited" : config.maxPostsPerMonth.toLocaleString()} posts/mo`,
          ];
          if (config.features.feedbackLoop) features.push("Feedback loop");
          if (config.features.aiAssetGeneration) features.push("AI image generation");
          if (config.features.whiteLabel) features.push("White-label dashboard");
          if (config.features.ipRotation) features.push("IP rotation");

          return (
            <div
              key={tier}
              className={`relative flex flex-col p-6 rounded-2xl border transition-all ${
                isPopular
                  ? "border-green-400 shadow-lg shadow-green-50 ring-2 ring-green-400"
                  : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
              } bg-white`}
            >
              {isPopular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white text-xs font-bold rounded-full">
                    <Zap className="w-3 h-3 fill-white" /> Most popular
                  </span>
                </div>
              )}

              <div className="mb-5">
                <h3 className="text-base font-bold text-gray-900 mb-1">{config.displayName}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-gray-900">${(price / 100).toFixed(0)}</span>
                  <span className="text-sm text-gray-400">/mo</span>
                </div>
                {billingInterval === "annual" && (
                  <p className="text-xs text-green-600 font-medium mt-1">Billed annually</p>
                )}
              </div>

              <ul className="space-y-2.5 mb-6 flex-1">
                {features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                    <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>

              {(() => {
                const currentRank = TIER_ORDER[currentTier as keyof typeof TIER_ORDER] ?? 0;
                const tierRank = TIER_ORDER[tier as keyof typeof TIER_ORDER] ?? 0;
                const isCurrentPlan = tier === currentTier;
                const isDowngrade = tierRank < currentRank;
                const label = isCurrentPlan
                  ? "Current plan"
                  : isDowngrade
                  ? `Downgrade to ${config.displayName}`
                  : `Upgrade to ${config.displayName}`;

                return (
                  <button
                    onClick={() => {
                      if (isCurrentPlan) return;
                      setSelectedTier(tier);
                      setDowngradeBlockers([]);
                      subscribe.mutate({ tier, interval: billingInterval });
                    }}
                    disabled={subscribe.isPending || isCurrentPlan}
                    className={`w-full py-2.5 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 ${
                      isCurrentPlan
                        ? "bg-gray-100 text-gray-400 cursor-default"
                        : isPopular
                        ? "bg-green-600 hover:bg-green-700 text-white"
                        : "bg-gray-900 hover:bg-gray-800 text-white"
                    }`}
                  >
                    {subscribe.isPending && selectedTier === tier ? "Processing…" : label}
                  </button>
                );
              })()}
            </div>
          );
        })}
      </div>

      {/* Promo code */}
      <div className="border-t border-gray-100 pt-6">
        <p className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-1.5">
          <Tag className="w-4 h-4 text-gray-400" />
          Have a promo code?
        </p>
        <PromoCodeInput tier={selectedTier} onApplied={setAppliedPromo} />
        {appliedPromo && (
          <p className="text-xs text-gray-500 mt-2">
            Discount will be applied at checkout.
            {appliedPromo.applicableTiers && appliedPromo.applicableTiers.length > 0 && (
              <span className="ml-1">
                Valid for: {appliedPromo.applicableTiers.join(", ")}
              </span>
            )}
          </p>
        )}
      </div>

      <p className="text-xs text-gray-400 text-center">
        All plans include the full 3-agent pipeline, human-in-the-loop dashboard, and brand ingestion.
        Cancel anytime — no lock-in.
      </p>
    </div>
  );
}

export default function UpgradePage() {
  return (
    <Suspense>
      <UpgradePageInner />
    </Suspense>
  );
}
