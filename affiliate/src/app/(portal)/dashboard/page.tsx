"use client";

import { useEffect, useState } from "react";
import { Link2, TrendingUp, DollarSign, Clock } from "lucide-react";
import { api } from "@/lib/api";

interface AffiliateProfile {
  id: string;
  name: string;
  status: "pending" | "approved" | "suspended";
  commissionRate: string;
  totalEarnedCents: number;
  totalPaidCents: number;
  payoutThresholdCents: number;
  createdAt: string;
}

interface AffiliateLink { id: string; code: string; campaign: string | null; clicks: number; conversions: number }

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string; sub?: string;
  icon: React.FC<{ className?: string }>; color: string
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

export default function AffiliateDashboard() {
  const [profile, setProfile] = useState<AffiliateProfile | null>(null);
  const [links, setLinks] = useState<AffiliateLink[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api.get<AffiliateProfile>("/affiliates/me"),
      api.get<AffiliateLink[]>("/affiliates/links"),
    ]).then(([p, l]) => { setProfile(p); setLinks(l); })
      .catch((e) => setError(e.message));
  }, []);

  const totalClicks = links.reduce((s, l) => s + l.clicks, 0);
  const totalConversions = links.reduce((s, l) => s + l.conversions, 0);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-bold text-white">Overview</h1>
        {profile && (
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              profile.status === "approved" ? "bg-green-900/50 text-green-400" :
              profile.status === "pending" ? "bg-yellow-900/50 text-yellow-400" :
              "bg-red-900/50 text-red-400"
            }`}>{profile.status}</span>
            <span className="text-sm text-gray-500">{(parseFloat(profile.commissionRate) * 100).toFixed(0)}% commission rate</span>
          </div>
        )}
      </div>

      {error && <div className="mb-6 p-3 rounded-lg bg-red-950 border border-red-800 text-red-400 text-sm">{error}</div>}

      {profile?.status === "pending" && (
        <div className="mb-6 p-4 rounded-xl bg-yellow-950 border border-yellow-800">
          <div className="flex items-center gap-2 text-yellow-400">
            <Clock className="w-4 h-4" />
            <p className="text-sm font-medium">Application under review</p>
          </div>
          <p className="text-xs text-yellow-500 mt-1">You can create tracking links once your account is approved.</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total earned"
          value={profile ? `$${(profile.totalEarnedCents / 100).toFixed(2)}` : "—"}
          sub={profile ? `$${(profile.totalPaidCents / 100).toFixed(2)} paid out` : undefined}
          icon={DollarSign} color="bg-purple-600"
        />
        <StatCard label="Active links" value={String(links.length)} icon={Link2} color="bg-blue-600" />
        <StatCard label="Total clicks" value={String(totalClicks)} icon={TrendingUp} color="bg-green-600" />
        <StatCard
          label="Conversions"
          value={String(totalConversions)}
          sub={totalClicks > 0 ? `${((totalConversions / totalClicks) * 100).toFixed(1)}% CVR` : undefined}
          icon={TrendingUp} color="bg-orange-600"
        />
      </div>

      {links.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-white">Your top links</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Code</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Campaign</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Clicks</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Conversions</th>
              </tr>
            </thead>
            <tbody>
              {links.slice(0, 5).map((link) => (
                <tr key={link.id} className="border-b border-gray-800 last:border-0">
                  <td className="px-5 py-3 font-mono text-sm text-purple-400">{link.code}</td>
                  <td className="px-5 py-3 text-gray-400">{link.campaign ?? "—"}</td>
                  <td className="px-5 py-3 text-white">{link.clicks}</td>
                  <td className="px-5 py-3 text-white">{link.conversions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
