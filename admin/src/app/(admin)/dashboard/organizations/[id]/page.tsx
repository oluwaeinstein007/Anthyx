"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Users, CreditCard } from "lucide-react";
import { api } from "@/lib/api";

interface Member { id: string; name: string; email: string; role: string; createdAt: string }
interface Subscription { id: string; tier: string; status: string; trialEndsAt?: string; currentPeriodEnd?: string }
interface OrgDetail {
  org: { id: string; name: string; slug: string; createdAt: string };
  members: Member[];
  subscription: Subscription | null;
}

const TIERS = ["free", "starter", "pro", "agency"];

export default function OrgDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<OrgDetail | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [tierOverride, setTierOverride] = useState("");

  useEffect(() => {
    api.get<OrgDetail>(`/admin/organizations/${id}`)
      .then((d) => { setData(d); setTierOverride(d.subscription?.tier ?? ""); })
      .catch((e) => setError(e.message));
  }, [id]);

  async function handleTierOverride() {
    if (!tierOverride) return;
    setSaving(true);
    try {
      await api.put(`/admin/organizations/${id}`, { tier: tierOverride });
      setData((prev) => prev && { ...prev, subscription: prev.subscription ? { ...prev.subscription, tier: tierOverride } : null });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  if (!data && !error) {
    return <div className="text-sm text-gray-500">Loading…</div>;
  }

  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-950 border border-red-800 text-red-400 text-sm">{error}</div>}

      {data && (
        <div className="space-y-6">
          <div>
            <h1 className="text-xl font-bold text-white">{data.org.name}</h1>
            <p className="text-sm text-gray-500 font-mono mt-1">{data.org.slug}</p>
          </div>

          {/* Subscription card */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-white">Subscription</h2>
            </div>
            {data.subscription ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-24">Tier</span>
                  <span className="text-sm text-white capitalize">{data.subscription.tier}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-24">Status</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    data.subscription.status === "active" ? "bg-green-900/50 text-green-400" : "bg-gray-800 text-gray-400"
                  }`}>{data.subscription.status}</span>
                </div>
                <div className="flex items-center gap-3 pt-2 border-t border-gray-800">
                  <span className="text-xs text-gray-500 w-24">Override tier</span>
                  <div className="flex items-center gap-2">
                    <select
                      value={tierOverride}
                      onChange={(e) => setTierOverride(e.target.value)}
                      className="bg-gray-800 border border-gray-700 rounded-lg text-sm text-white px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <button
                      onClick={handleTierOverride}
                      disabled={saving}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-red-900 text-white rounded-lg text-xs font-semibold transition-colors"
                    >
                      {saving ? "Saving…" : "Apply"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No subscription</p>
            )}
          </div>

          {/* Members table */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-800 flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-white">Members ({data.members.length})</h2>
            </div>
            {data.members.length === 0 ? (
              <div className="p-5 text-sm text-gray-500">No members</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Name</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Email</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Role</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {data.members.map((m) => (
                    <tr key={m.id} className="border-b border-gray-800 last:border-0">
                      <td className="px-5 py-3 text-white font-medium">{m.name}</td>
                      <td className="px-5 py-3 text-gray-400">{m.email}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          m.role === "owner" ? "bg-purple-900/50 text-purple-400" : "bg-gray-800 text-gray-400"
                        }`}>{m.role}</span>
                      </td>
                      <td className="px-5 py-3 text-gray-400">{new Date(m.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
