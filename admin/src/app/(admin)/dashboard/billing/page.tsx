"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { CreditCard, TrendingUp, Users } from "lucide-react";

interface SubRow {
  id: string;
  tier: string;
  status: string;
  billingProvider: string;
  billingInterval: string;
  currentPeriodEnd: string | null;
  createdAt: string;
  organization: { id: string; name: string; slug: string } | null;
}

interface BillingStats {
  total: number;
  byTier: Array<{ tier: string; count: number }>;
}

const TIER_COLORS: Record<string, string> = {
  sandbox: "bg-gray-800 text-gray-400",
  starter: "bg-blue-900/50 text-blue-400",
  growth: "bg-green-900/50 text-green-400",
  agency: "bg-purple-900/50 text-purple-400",
  scale: "bg-orange-900/50 text-orange-400",
  enterprise: "bg-red-900/50 text-red-400",
};

export default function AdminBillingPage() {
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [stats, setStats] = useState<BillingStats | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api.get<SubRow[]>("/admin/billing"),
      api.get<BillingStats>("/admin/billing/stats"),
    ])
      .then(([s, st]) => { setSubs(s); setStats(st); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = subs.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.organization?.name?.toLowerCase().includes(q) ||
      s.tier.includes(q) ||
      s.status.includes(q)
    );
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-bold text-white">Billing</h1>
        <p className="text-sm text-gray-500 mt-1">All organization subscriptions</p>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-950 border border-red-800 text-red-400 text-sm">{error}</div>}

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-gray-500" />
              <span className="text-xs text-gray-500">Total</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.total}</p>
          </div>
          {stats.byTier.map((t) => (
            <div key={t.tier} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <CreditCard className="w-4 h-4 text-gray-500" />
                <span className="text-xs text-gray-500 capitalize">{t.tier}</span>
              </div>
              <p className="text-2xl font-bold text-white">{t.count}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by org name, tier, or status…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
        />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">No subscriptions found</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Organization</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Tier</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Provider</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Period End</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-b border-gray-800 last:border-0">
                  <td className="px-5 py-3">
                    <p className="font-medium text-white">{s.organization?.name ?? "—"}</p>
                    <p className="text-xs text-gray-500">{s.organization?.slug ?? s.id.slice(0, 8)}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${TIER_COLORS[s.tier] ?? "bg-gray-800 text-gray-400"}`}>
                      {s.tier}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      s.status === "active" ? "bg-green-900/50 text-green-400" : "bg-gray-800 text-gray-400"
                    }`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-400 capitalize">{s.billingProvider}</td>
                  <td className="px-5 py-3 text-gray-400">
                    {s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toLocaleDateString() : "—"}
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
