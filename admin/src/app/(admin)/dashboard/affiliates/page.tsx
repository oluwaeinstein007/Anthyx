"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Affiliate {
  id: string;
  userId: string;
  status: "pending" | "approved" | "suspended";
  commissionRate: string;
  totalEarnedCents: number;
  totalPaidCents: number;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-900/50 text-yellow-400",
  approved: "bg-green-900/50 text-green-400",
  suspended: "bg-red-900/50 text-red-400",
};

export default function AffiliatesPage() {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    api.get<Affiliate[]>("/admin/affiliates")
      .then(setAffiliates)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function updateAffiliate(id: string, updates: { status?: string; commissionRate?: string }) {
    setSaving(id);
    try {
      await api.put(`/admin/affiliates/${id}`, updates);
      setAffiliates((prev) =>
        prev.map((a) => a.id === id ? { ...a, ...updates } as Affiliate : a)
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-bold text-white">Affiliates</h1>
        <p className="text-sm text-gray-500 mt-1">{affiliates.length} affiliates</p>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-950 border border-red-800 text-red-400 text-sm">{error}</div>}

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Loading…</div>
        ) : affiliates.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">No affiliates yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">User ID</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Commission</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Earned</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Paid out</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Joined</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {affiliates.map((a) => (
                <tr key={a.id} className="border-b border-gray-800 last:border-0">
                  <td className="px-5 py-3 font-mono text-xs text-gray-400">{a.userId.slice(0, 8)}…</td>
                  <td className="px-5 py-3">
                    <select
                      value={a.status}
                      onChange={(e) => updateAffiliate(a.id, { status: e.target.value })}
                      disabled={saving === a.id}
                      className={`text-xs font-medium px-2 py-0.5 rounded-full border-0 focus:outline-none cursor-pointer ${STATUS_COLORS[a.status] ?? ""}`}
                    >
                      <option value="pending">pending</option>
                      <option value="approved">approved</option>
                      <option value="suspended">suspended</option>
                    </select>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1">
                      <input
                        type="number" step="0.01" min="0" max="100"
                        defaultValue={parseFloat(a.commissionRate)}
                        onBlur={(e) => {
                          if (e.target.value !== a.commissionRate) {
                            updateAffiliate(a.id, { commissionRate: e.target.value });
                          }
                        }}
                        className="w-16 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                      />
                      <span className="text-xs text-gray-500">%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-300">${(a.totalEarnedCents / 100).toFixed(2)}</td>
                  <td className="px-5 py-3 text-gray-300">${(a.totalPaidCents / 100).toFixed(2)}</td>
                  <td className="px-5 py-3 text-gray-400">{new Date(a.createdAt).toLocaleDateString()}</td>
                  <td className="px-5 py-3 text-right">
                    {saving === a.id && <span className="text-xs text-gray-500">Saving…</span>}
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
