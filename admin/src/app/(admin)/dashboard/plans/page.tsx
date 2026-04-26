"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Layers, Check, X } from "lucide-react";

interface PlanTier {
  id: string;
  tier: string;
  displayName: string;
  monthlyPrice: number;
  annualPrice: number;
  maxBrands: number;
  maxAgents: number;
  maxSocialAccounts: number;
  maxPostsPerMonth: number;
  maxTeamMembers: number;
  autonomousScheduling: boolean;
  feedbackLoop: boolean;
  aiAssetGeneration: boolean;
  ipRotation: boolean;
  whiteLabel: boolean;
  hitlRequired: boolean;
  guardrails: boolean;
  rbac: boolean;
}

function FeatureDot({ on }: { on: boolean }) {
  return on ? (
    <Check className="w-3.5 h-3.5 text-green-400" />
  ) : (
    <X className="w-3.5 h-3.5 text-gray-600" />
  );
}

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<PlanTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // plan tiers are static config — call stats which gives us tier breakdown from subscriptions
    // For the display we use the PLAN_TIER_CONFIGS from package
    api.get<PlanTier[]>("/admin/billing/stats")
      .catch(() => null)
      .finally(() => setLoading(false));

    // Fetch from a static config endpoint if available; for now we display the known tiers
    const KNOWN_TIERS: PlanTier[] = [
      { id: "sandbox", tier: "sandbox", displayName: "Sandbox", monthlyPrice: 0, annualPrice: 0, maxBrands: 1, maxAgents: 1, maxSocialAccounts: 2, maxPostsPerMonth: 20, maxTeamMembers: 1, autonomousScheduling: false, feedbackLoop: false, aiAssetGeneration: false, ipRotation: false, whiteLabel: false, hitlRequired: true, guardrails: false, rbac: false },
      { id: "starter", tier: "starter", displayName: "Starter", monthlyPrice: 4900, annualPrice: 3920, maxBrands: 1, maxAgents: 2, maxSocialAccounts: 5, maxPostsPerMonth: 100, maxTeamMembers: 2, autonomousScheduling: false, feedbackLoop: false, aiAssetGeneration: false, ipRotation: false, whiteLabel: false, hitlRequired: true, guardrails: true, rbac: false },
      { id: "growth", tier: "growth", displayName: "Growth", monthlyPrice: 9900, annualPrice: 7920, maxBrands: 3, maxAgents: 5, maxSocialAccounts: 15, maxPostsPerMonth: 500, maxTeamMembers: 5, autonomousScheduling: true, feedbackLoop: true, aiAssetGeneration: true, ipRotation: false, whiteLabel: false, hitlRequired: false, guardrails: true, rbac: true },
      { id: "agency", tier: "agency", displayName: "Agency", monthlyPrice: 24900, annualPrice: 19920, maxBrands: 10, maxAgents: 20, maxSocialAccounts: 50, maxPostsPerMonth: 2000, maxTeamMembers: 15, autonomousScheduling: true, feedbackLoop: true, aiAssetGeneration: true, ipRotation: true, whiteLabel: false, hitlRequired: false, guardrails: true, rbac: true },
      { id: "scale", tier: "scale", displayName: "Scale", monthlyPrice: 49900, annualPrice: 39920, maxBrands: -1, maxAgents: -1, maxSocialAccounts: -1, maxPostsPerMonth: -1, maxTeamMembers: -1, autonomousScheduling: true, feedbackLoop: true, aiAssetGeneration: true, ipRotation: true, whiteLabel: true, hitlRequired: false, guardrails: true, rbac: true },
    ];
    setPlans(KNOWN_TIERS);
    setLoading(false);
  }, []);

  const fmt = (v: number) => v === -1 ? "∞" : v.toLocaleString();
  const price = (cents: number) => cents === 0 ? "Free" : `$${(cents / 100).toFixed(0)}/mo`;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-bold text-white">Plan Tiers</h1>
        <p className="text-sm text-gray-500 mt-1">Current plan feature matrix</p>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-950 border border-red-800 text-red-400 text-sm">{error}</div>}

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Loading…</div>
        ) : (
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Feature</th>
                {plans.map((p) => (
                  <th key={p.tier} className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">{p.displayName}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {[
                { label: "Price (monthly)", fn: (p: PlanTier) => price(p.monthlyPrice) },
                { label: "Price (annual)", fn: (p: PlanTier) => price(p.annualPrice) },
                { label: "Brands", fn: (p: PlanTier) => fmt(p.maxBrands) },
                { label: "Agents", fn: (p: PlanTier) => fmt(p.maxAgents) },
                { label: "Social accounts", fn: (p: PlanTier) => fmt(p.maxSocialAccounts) },
                { label: "Posts/month", fn: (p: PlanTier) => fmt(p.maxPostsPerMonth) },
                { label: "Team members", fn: (p: PlanTier) => fmt(p.maxTeamMembers) },
              ].map(({ label, fn }) => (
                <tr key={label}>
                  <td className="px-5 py-3 text-gray-300">{label}</td>
                  {plans.map((p) => (
                    <td key={p.tier} className="px-4 py-3 text-center text-white font-medium">{fn(p)}</td>
                  ))}
                </tr>
              ))}
              {[
                { label: "Autonomous scheduling", key: "autonomousScheduling" as const },
                { label: "Feedback loop", key: "feedbackLoop" as const },
                { label: "AI asset generation", key: "aiAssetGeneration" as const },
                { label: "IP rotation", key: "ipRotation" as const },
                { label: "White label", key: "whiteLabel" as const },
                { label: "HITL required", key: "hitlRequired" as const },
                { label: "Guardrails", key: "guardrails" as const },
                { label: "RBAC", key: "rbac" as const },
              ].map(({ label, key }) => (
                <tr key={label}>
                  <td className="px-5 py-3 text-gray-300">{label}</td>
                  {plans.map((p) => (
                    <td key={p.tier} className="px-4 py-3 text-center">
                      <div className="flex justify-center"><FeatureDot on={p[key]} /></div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
