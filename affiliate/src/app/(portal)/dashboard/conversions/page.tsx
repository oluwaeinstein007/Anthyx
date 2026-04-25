"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Conversion {
  id: string;
  affiliateLinkId: string;
  planTier: string;
  commissionCents: number;
  status: "pending" | "cleared" | "paid";
  clearedAt: string | null;
  paidAt: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-900/50 text-yellow-400",
  cleared: "bg-blue-900/50 text-blue-400",
  paid: "bg-green-900/50 text-green-400",
};

export default function ConversionsPage() {
  const [conversions, setConversions] = useState<Conversion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<Conversion[]>("/affiliates/conversions")
      .then(setConversions)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-bold text-white">Conversions</h1>
        <p className="text-sm text-gray-500 mt-1">{conversions.length} total conversions</p>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-950 border border-red-800 text-red-400 text-sm">{error}</div>}

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Loading…</div>
        ) : conversions.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">No conversions yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Plan</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Commission</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Cleared</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Paid</th>
              </tr>
            </thead>
            <tbody>
              {conversions.map((c) => (
                <tr key={c.id} className="border-b border-gray-800 last:border-0">
                  <td className="px-5 py-3 text-white capitalize">{c.planTier}</td>
                  <td className="px-5 py-3 text-white">${(c.commissionCents / 100).toFixed(2)}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status] ?? ""}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-400">
                    {c.clearedAt ? new Date(c.clearedAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-5 py-3 text-gray-400">
                    {c.paidAt ? new Date(c.paidAt).toLocaleDateString() : "—"}
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
