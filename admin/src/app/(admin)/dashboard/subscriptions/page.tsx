"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Org { id: string; name: string; slug: string }
interface Sub {
  id: string;
  organizationId: string;
  tier: string;
  status: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  createdAt: string;
}

const TIERS = ["free", "starter", "pro", "agency"];
const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-900/50 text-green-400",
  trialing: "bg-blue-900/50 text-blue-400",
  past_due: "bg-yellow-900/50 text-yellow-400",
  canceled: "bg-gray-800 text-gray-400",
};

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState<(Sub & { orgName: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [overriding, setOverriding] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<Org[]>("/admin/organizations"),
      // Fetch all orgs and then enrich — subscriptions are embedded in org detail
    ]).then(async ([orgs]) => {
      const details = await Promise.all(
        orgs.map((o) =>
          api.get<{ org: Org; subscription: Sub | null }>(`/admin/organizations/${o.id}`)
        )
      );
      const enriched = details
        .filter((d) => d.subscription)
        .map((d) => ({ ...d.subscription!, orgName: d.org.name }));
      setSubs(enriched);
    }).catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function overrideTier(subId: string, tier: string) {
    setOverriding(subId);
    try {
      await api.post(`/admin/subscriptions/${subId}/override`, { tier });
      setSubs((prev) => prev.map((s) => s.id === subId ? { ...s, tier } : s));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setOverriding(null);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-bold text-white">Subscriptions</h1>
        <p className="text-sm text-gray-500 mt-1">{subs.length} active subscriptions</p>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-950 border border-red-800 text-red-400 text-sm">{error}</div>}

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Loading…</div>
        ) : subs.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">No subscriptions</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Organisation</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Tier</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Renews</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Override tier</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((sub) => (
                <tr key={sub.id} className="border-b border-gray-800 last:border-0">
                  <td className="px-5 py-3 text-white font-medium">{sub.orgName}</td>
                  <td className="px-5 py-3 text-gray-300 capitalize">{sub.tier}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[sub.status] ?? "bg-gray-800 text-gray-400"}`}>
                      {sub.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-400">
                    {sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <select
                        defaultValue={sub.tier}
                        onChange={(e) => overrideTier(sub.id, e.target.value)}
                        disabled={overriding === sub.id}
                        className="bg-gray-800 border border-gray-700 rounded-lg text-xs text-white px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-500"
                      >
                        {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      {overriding === sub.id && <span className="text-xs text-gray-500">Saving…</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
