"use client";

import { PLAN_TIER_CONFIGS, CREDIT_COSTS } from "@anthyx/config";
import type { PlanTier } from "@anthyx/types";

const VISIBLE_TIERS: PlanTier[] = ["sandbox", "starter", "growth", "agency", "scale"];

interface PlanCompareTableProps {
  currentTier: PlanTier;
  onSelect?: (tier: PlanTier) => void;
}

function fmt(cents: number) {
  if (cents < 0) return "Custom";
  if (cents === 0) return "Free";
  return `$${(cents / 100).toFixed(0)}/mo`;
}

function limitLabel(n: number) {
  return n === -1 ? "Unlimited" : String(n);
}

const FEATURE_ROWS: Array<{ key: keyof typeof PLAN_TIER_CONFIGS["sandbox"]["features"]; label: string }> = [
  { key: "autonomousScheduling", label: "Autonomous scheduling" },
  { key: "feedbackLoop", label: "Feedback loop" },
  { key: "aiAssetGeneration", label: "AI asset generation" },
  { key: "ipRotation", label: "IP rotation" },
  { key: "whiteLabel", label: "White label" },
  { key: "guardrails", label: "Guardrails" },
  { key: "agentSilence", label: "Agent silence" },
  { key: "rbac", label: "Role-based access" },
];

export function PlanCompareTable({ currentTier, onSelect }: PlanCompareTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th className="text-left py-3 pr-4 text-gray-500 font-medium w-40" />
            {VISIBLE_TIERS.map((tier) => {
              const config = PLAN_TIER_CONFIGS[tier];
              const isCurrent = tier === currentTier;
              return (
                <th
                  key={tier}
                  className={`text-center py-3 px-3 font-semibold rounded-t-lg ${
                    isCurrent ? "bg-blue-50 text-blue-700" : "text-gray-900"
                  }`}
                >
                  <div>{config.displayName}</div>
                  <div className="text-base font-bold mt-0.5">{fmt(config.monthlyPrice)}</div>
                  {onSelect && !isCurrent && (
                    <button
                      onClick={() => onSelect(tier)}
                      className="mt-2 text-xs px-3 py-1 rounded-full bg-blue-600 text-white hover:bg-blue-700"
                    >
                      Upgrade
                    </button>
                  )}
                  {isCurrent && (
                    <span className="mt-2 inline-block text-xs px-3 py-1 rounded-full bg-blue-100 text-blue-700">
                      Current
                    </span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-gray-100">
            <td className="py-2 pr-4 text-gray-500">Posts / month</td>
            {VISIBLE_TIERS.map((t) => (
              <td key={t} className={`text-center py-2 px-3 ${t === currentTier ? "bg-blue-50" : ""}`}>
                {limitLabel(PLAN_TIER_CONFIGS[t].maxPostsPerMonth)}
              </td>
            ))}
          </tr>
          <tr className="border-t border-gray-100">
            <td className="py-2 pr-4 text-gray-500">Brands</td>
            {VISIBLE_TIERS.map((t) => (
              <td key={t} className={`text-center py-2 px-3 ${t === currentTier ? "bg-blue-50" : ""}`}>
                {limitLabel(PLAN_TIER_CONFIGS[t].maxBrands)}
              </td>
            ))}
          </tr>
          <tr className="border-t border-gray-100">
            <td className="py-2 pr-4 text-gray-500">Agents</td>
            {VISIBLE_TIERS.map((t) => (
              <td key={t} className={`text-center py-2 px-3 ${t === currentTier ? "bg-blue-50" : ""}`}>
                {limitLabel(PLAN_TIER_CONFIGS[t].maxAgents)}
              </td>
            ))}
          </tr>
          <tr className="border-t border-gray-100">
            <td className="py-2 pr-4 text-gray-500">Social accounts</td>
            {VISIBLE_TIERS.map((t) => (
              <td key={t} className={`text-center py-2 px-3 ${t === currentTier ? "bg-blue-50" : ""}`}>
                {limitLabel(PLAN_TIER_CONFIGS[t].maxSocialAccounts)}
              </td>
            ))}
          </tr>
          {FEATURE_ROWS.map(({ key, label }) => (
            <tr key={key} className="border-t border-gray-100">
              <td className="py-2 pr-4 text-gray-500">{label}</td>
              {VISIBLE_TIERS.map((t) => (
                <td key={t} className={`text-center py-2 px-3 ${t === currentTier ? "bg-blue-50" : ""}`}>
                  {PLAN_TIER_CONFIGS[t].features[key] ? (
                    <span className="text-green-600">✓</span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
          <tr className="border-t border-gray-100">
            <td className="py-2 pr-4 text-gray-500 text-xs">Extra post cost</td>
            {VISIBLE_TIERS.map((t) => (
              <td key={t} className={`text-center py-2 px-3 text-xs text-gray-400 ${t === currentTier ? "bg-blue-50" : ""}`}>
                {PLAN_TIER_CONFIGS[t].overagePricePerPost > 0
                  ? `$${(PLAN_TIER_CONFIGS[t].overagePricePerPost / 100).toFixed(2)}`
                  : "—"}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <p className="mt-3 text-xs text-gray-400">
        Credit costs: {CREDIT_COSTS.TEXT_POST} credit per post · {CREDIT_COSTS.AI_IMAGE} credits per AI image · {CREDIT_COSTS.BRAND_ANALYSIS} credits per brand analysis
      </p>
    </div>
  );
}
