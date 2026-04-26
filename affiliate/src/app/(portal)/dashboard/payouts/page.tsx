"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Wallet, Clock, CheckCircle2, DollarSign, AlertCircle } from "lucide-react";

interface AffiliateProfile {
  totalEarnedCents: number;
  totalPaidCents: number;
  payoutThresholdCents: number;
  status: string;
}

interface Conversion {
  id: string;
  planTier: string;
  commissionCents: number;
  status: "pending" | "cleared" | "paid";
  clearedAt: string | null;
  paidAt: string | null;
}

interface PayoutsResponse {
  affiliate: AffiliateProfile;
  payouts: Conversion[];
}

const STATUS_CONFIG = {
  pending: { label: "Pending", color: "bg-yellow-900/50 text-yellow-400", icon: Clock },
  cleared: { label: "Cleared", color: "bg-blue-900/50 text-blue-400", icon: CheckCircle2 },
  paid: { label: "Paid", color: "bg-green-900/50 text-green-400", icon: DollarSign },
};

export default function PayoutsPage() {
  const [data, setData] = useState<PayoutsResponse | null>(null);
  const [error, setError] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState("");

  useEffect(() => {
    api.get<PayoutsResponse>("/affiliates/payouts")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  async function handleRequestPayout() {
    setRequesting(true);
    try {
      const r = await api.post<{ requested: boolean; message: string }>("/affiliates/payouts/request");
      setRequestSuccess(r.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setRequesting(false);
    }
  }

  const profile = data?.affiliate;
  const payouts = data?.payouts ?? [];
  const unpaidBalance = profile ? (profile.totalEarnedCents - profile.totalPaidCents) : 0;
  const threshold = profile?.payoutThresholdCents ?? 5000;
  const canRequest = unpaidBalance >= threshold && profile?.status === "approved";

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-bold text-white">Payouts</h1>
        <p className="text-sm text-gray-500 mt-1">Your payout history and balance</p>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-950 border border-red-800 text-red-400 text-sm">{error}</div>}
      {requestSuccess && (
        <div className="mb-4 p-3 rounded-lg bg-green-950 border border-green-800 text-green-400 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {requestSuccess}
        </div>
      )}

      {profile && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Total earned</p>
            <p className="text-2xl font-bold text-white">${(profile.totalEarnedCents / 100).toFixed(2)}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Total paid out</p>
            <p className="text-2xl font-bold text-white">${(profile.totalPaidCents / 100).toFixed(2)}</p>
          </div>
          <div className={`border rounded-xl p-5 ${unpaidBalance >= threshold ? "bg-purple-950 border-purple-800" : "bg-gray-900 border-gray-800"}`}>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Available balance</p>
            <p className={`text-2xl font-bold ${unpaidBalance >= threshold ? "text-purple-300" : "text-white"}`}>
              ${(unpaidBalance / 100).toFixed(2)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Threshold: ${(threshold / 100).toFixed(2)}
            </p>
          </div>
        </div>
      )}

      {canRequest && !requestSuccess && (
        <button
          onClick={handleRequestPayout}
          disabled={requesting}
          className="mb-6 flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors"
        >
          <Wallet className="w-4 h-4" />
          {requesting ? "Requesting…" : `Request payout ($${(unpaidBalance / 100).toFixed(2)})`}
        </button>
      )}

      {!canRequest && unpaidBalance < threshold && profile && (
        <div className="mb-6 flex items-center gap-2 p-3 rounded-xl bg-gray-900 border border-gray-800 text-sm text-gray-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          Minimum payout is ${(threshold / 100).toFixed(2)}. Earn ${((threshold - unpaidBalance) / 100).toFixed(2)} more to request a payout.
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">Payout history</h2>
        </div>
        {payouts.length === 0 ? (
          <div className="p-10 text-center text-gray-500 text-sm">No cleared or paid conversions yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Plan</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Commission</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => {
                const cfg = STATUS_CONFIG[p.status];
                return (
                  <tr key={p.id} className="border-b border-gray-800 last:border-0">
                    <td className="px-5 py-3 text-white capitalize">{p.planTier}</td>
                    <td className="px-5 py-3 text-white font-medium">${(p.commissionCents / 100).toFixed(2)}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
                    </td>
                    <td className="px-5 py-3 text-gray-400">
                      {p.paidAt
                        ? new Date(p.paidAt).toLocaleDateString()
                        : p.clearedAt
                        ? new Date(p.clearedAt).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
