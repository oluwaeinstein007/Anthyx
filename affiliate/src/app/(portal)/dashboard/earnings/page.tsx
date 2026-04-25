"use client";

import { useEffect, useState } from "react";
import { DollarSign, TrendingUp, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";

interface AffiliateProfile {
  totalEarnedCents: number;
  totalPaidCents: number;
  payoutThresholdCents: number;
  commissionRate: string;
  stripeAccountId: string | null;
}

export default function EarningsPage() {
  const [profile, setProfile] = useState<AffiliateProfile | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<AffiliateProfile>("/affiliates/me")
      .then(setProfile)
      .catch((e) => setError(e.message));
  }, []);

  const unpaidCents = profile ? profile.totalEarnedCents - profile.totalPaidCents : 0;
  const thresholdMet = profile ? unpaidCents >= profile.payoutThresholdCents : false;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-bold text-white">Earnings</h1>
        <p className="text-sm text-gray-500 mt-1">Commission summary and payout status</p>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-950 border border-red-800 text-red-400 text-sm">{error}</div>}

      {profile && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total earned</span>
                <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-white" />
                </div>
              </div>
              <p className="text-2xl font-bold text-white">${(profile.totalEarnedCents / 100).toFixed(2)}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Paid out</span>
                <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-white" />
                </div>
              </div>
              <p className="text-2xl font-bold text-white">${(profile.totalPaidCents / 100).toFixed(2)}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Available</span>
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-white" />
                </div>
              </div>
              <p className="text-2xl font-bold text-white">${(unpaidCents / 100).toFixed(2)}</p>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Payout status</h2>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Payout threshold</span>
                <span className="text-white">${(profile.payoutThresholdCents / 100).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Available balance</span>
                <span className={thresholdMet ? "text-green-400 font-medium" : "text-white"}>${(unpaidCents / 100).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Commission rate</span>
                <span className="text-white">{(parseFloat(profile.commissionRate) * 100).toFixed(0)}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Stripe account</span>
                <span className={profile.stripeAccountId ? "text-green-400" : "text-gray-500"}>
                  {profile.stripeAccountId ? "Connected" : "Not connected"}
                </span>
              </div>
            </div>

            {!profile.stripeAccountId && (
              <div className="mt-4 p-3 rounded-lg bg-yellow-950 border border-yellow-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-400">Connect a Stripe account to receive payouts. Contact support to get set up.</p>
              </div>
            )}

            {thresholdMet && profile.stripeAccountId && (
              <div className="mt-4 p-3 rounded-lg bg-green-950 border border-green-800">
                <p className="text-xs text-green-400">Your balance has reached the payout threshold. Payouts are processed monthly.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
