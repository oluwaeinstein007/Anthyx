"use client";

import { useEffect, useState } from "react";
import { Building2, Users, FileText, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";

interface Stats { organizations: number; users: number; postsPublished: number; }

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: React.FC<{ className?: string }>; color: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<Stats>("/admin/stats")
      .then(setStats)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-bold text-white">Platform Overview</h1>
        <p className="text-sm text-gray-500 mt-1">Live stats across all organisations</p>
      </div>

      {error && <div className="mb-6 p-3 rounded-lg bg-red-950 border border-red-800 text-red-400 text-sm">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Organisations" value={stats?.organizations ?? "—"} icon={Building2} color="bg-blue-600" />
        <StatCard label="Users" value={stats?.users ?? "—"} icon={Users} color="bg-purple-600" />
        <StatCard label="Posts Published" value={stats?.postsPublished ?? "—"} icon={FileText} color="bg-green-600" />
        <StatCard label="Active Plans" value="—" icon={TrendingUp} color="bg-orange-600" />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-1">Quick actions</h2>
        <p className="text-xs text-gray-500">Use the sidebar to navigate to organisations, users, promo codes, feature flags, and more.</p>
      </div>
    </div>
  );
}
