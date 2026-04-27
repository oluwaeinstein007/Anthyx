"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Layers, Check, X, Pencil, Save } from "lucide-react";

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

interface EditState {
  tier: string;
  monthlyPrice: string;
  annualPrice: string;
}

function FeatureDot({ on }: { on: boolean }) {
  return on ? (
    <Check className="w-3.5 h-3.5 text-green-400" />
  ) : (
    <X className="w-3.5 h-3.5 text-gray-600" />
  );
}

const fmt = (v: number) => v === -1 ? "∞" : v.toLocaleString();
const price = (cents: number) => cents === 0 ? "Free" : `$${(cents / 100).toFixed(0)}/mo`;

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<PlanTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [successTier, setSuccessTier] = useState<string | null>(null);

  useEffect(() => {
    api.get<PlanTier[]>("/admin/plans")
      .then(setPlans)
      .catch(() => setError("Failed to load plan tiers"))
      .finally(() => setLoading(false));
  }, []);

  function startEdit(plan: PlanTier) {
    setEditing({
      tier: plan.tier,
      monthlyPrice: String(plan.monthlyPrice / 100),
      annualPrice: String(plan.annualPrice / 100),
    });
    setSaveError("");
    setSuccessTier(null);
  }

  function cancelEdit() {
    setEditing(null);
    setSaveError("");
  }

  async function saveEdit() {
    if (!editing) return;

    const monthly = Math.round(parseFloat(editing.monthlyPrice) * 100);
    const annual = Math.round(parseFloat(editing.annualPrice) * 100);

    if (isNaN(monthly) || monthly < 0) { setSaveError("Invalid monthly price"); return; }
    if (isNaN(annual) || annual < 0) { setSaveError("Invalid annual price"); return; }

    setSaving(true);
    setSaveError("");
    try {
      const updated = await api.put<PlanTier>(`/admin/plans/${editing.tier}`, {
        monthlyPrice: monthly,
        annualPrice: annual,
      });
      setPlans((prev) => prev.map((p) => p.tier === updated.tier ? updated : p));
      setSuccessTier(editing.tier);
      setEditing(null);
      setTimeout(() => setSuccessTier(null), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <Layers className="w-5 h-5 text-red-500" />
          <h1 className="text-xl font-bold text-white">Plan Tiers</h1>
        </div>
        <p className="text-sm text-gray-500">Click the edit icon to update pricing. Price changes apply to new subscribers only.</p>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-950 border border-red-800 text-red-400 text-sm">{error}</div>}

      {/* Price editing panel */}
      {editing && (
        <div className="mb-6 bg-gray-900 border border-gray-700 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4 capitalize">
            Editing prices for <span className="text-red-400">{plans.find((p) => p.tier === editing.tier)?.displayName ?? editing.tier}</span>
          </h2>
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Monthly price (USD)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editing.monthlyPrice}
                  onChange={(e) => setEditing({ ...editing, monthlyPrice: e.target.value })}
                  className="w-full pl-7 pr-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Annual price (USD/mo equivalent)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editing.annualPrice}
                  onChange={(e) => setEditing({ ...editing, annualPrice: e.target.value })}
                  className="w-full pl-7 pr-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>
          </div>
          {saveError && <p className="text-xs text-red-400 mb-3">{saveError}</p>}
          <div className="flex gap-2">
            <button
              onClick={saveEdit}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 disabled:bg-red-900 text-white rounded-lg transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button
              onClick={cancelEdit}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
          <p className="mt-3 text-xs text-gray-600">Changes apply to new subscribers only. Existing subscribers stay on their current price.</p>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Loading…</div>
        ) : (
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Feature</th>
                {plans.map((p) => (
                  <th key={p.tier} className="text-center px-4 py-3">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xs font-medium text-gray-500 uppercase">{p.displayName}</span>
                      <button
                        onClick={() => startEdit(p)}
                        className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-md transition-colors ${
                          successTier === p.tier
                            ? "text-green-400 bg-green-950"
                            : "text-gray-500 hover:text-gray-300 hover:bg-gray-800"
                        }`}
                      >
                        <Pencil className="w-2.5 h-2.5" />
                        {successTier === p.tier ? "Saved" : "Edit"}
                      </button>
                    </div>
                  </th>
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
                { label: "Team members", fn: (p: PlanTier) => fmt(p.maxTeamMembers ?? 1) },
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
