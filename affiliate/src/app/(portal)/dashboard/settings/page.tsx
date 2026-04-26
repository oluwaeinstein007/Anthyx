"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Settings, Check, AlertCircle } from "lucide-react";

interface AffiliateProfile {
  id: string;
  name: string;
  email: string;
  status: string;
  commissionRate: string;
  payoutThresholdCents: number;
  stripeAccountId: string | null;
  createdAt: string;
}

export default function AffiliateSettingsPage() {
  const [profile, setProfile] = useState<AffiliateProfile | null>(null);
  const [name, setName] = useState("");
  const [stripeAccountId, setStripeAccountId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<AffiliateProfile>("/affiliates/me")
      .then((p) => {
        setProfile(p);
        setName(p.name);
        setStripeAccountId(p.stripeAccountId ?? "");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.patch("/affiliates/me", {
        name: name.trim() || undefined,
        stripeAccountId: stripeAccountId.trim() || undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-sm text-gray-500 animate-pulse">Loading…</div>;

  return (
    <div className="max-w-xl">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-white">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your affiliate account</p>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-red-950 border border-red-800 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {profile && (
        <>
          <div className="bg-gray-900 border border-gray-800 rounded-xl divide-y divide-gray-800 mb-6">
            {[
              ["Account ID", profile.id.slice(0, 16) + "…"],
              ["Status", profile.status],
              ["Commission rate", `${(parseFloat(profile.commissionRate) * 100).toFixed(0)}%`],
              ["Payout threshold", `$${(profile.payoutThresholdCents / 100).toFixed(2)}`],
              ["Member since", new Date(profile.createdAt).toLocaleDateString()],
            ].map(([k, v]) => (
              <div key={k as string} className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-gray-400">{k}</span>
                <span className="text-sm text-white capitalize">{v}</span>
              </div>
            ))}
          </div>

          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Display name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-900 border border-gray-800 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Your name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Stripe Connect account ID
                <span className="ml-2 text-xs text-gray-500 font-normal">(for payouts)</span>
              </label>
              <input
                type="text"
                value={stripeAccountId}
                onChange={(e) => setStripeAccountId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-900 border border-gray-800 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="acct_…"
              />
              <p className="text-xs text-gray-600 mt-1">
                Provide your Stripe Connect account ID to receive payouts directly. Contact support if you need help setting this up.
              </p>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors"
            >
              {saved ? (
                <><Check className="w-4 h-4" /> Saved</>
              ) : saving ? (
                "Saving…"
              ) : (
                "Save changes"
              )}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
