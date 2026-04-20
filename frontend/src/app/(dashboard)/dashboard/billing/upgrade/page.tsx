"use client";

import { Suspense, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PLAN_TIER_CONFIGS } from "@anthyx/types";
import { useSearchParams } from "next/navigation";
import { Check, Zap } from "lucide-react";

const UPGRADEABLE_TIERS = ["starter", "growth", "agency", "scale"] as const;

function UpgradePageInner() {
  const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">("monthly");
  const searchParams = useSearchParams();
  const cancelled = searchParams.get("cancelled");

  const subscribe = useMutation({
    mutationFn: ({ tier, interval }: { tier: string; interval: string }) =>
      api.post<{ checkoutUrl: string }>("/billing/subscribe", { tier, interval, provider: "paystack" }),
    onSuccess: (data) => { window.location.href = data.checkoutUrl; },
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

              <button
                onClick={() => subscribe.mutate({ tier, interval: billingInterval })}
                disabled={subscribe.isPending}
                className={`w-full py-2.5 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 ${
                  isPopular
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : "bg-gray-900 hover:bg-gray-800 text-white"
                }`}
              >
                {subscribe.isPending ? "Redirecting…" : `Get ${config.displayName}`}
              </button>
            </div>
          );
        })}
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
