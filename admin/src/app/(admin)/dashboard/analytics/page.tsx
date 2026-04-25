"use client";

import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { api } from "@/lib/api";

interface PlatformStat { platform: string; postCount: number; avgEngagement: number }
interface AnalyticsOverview { byPlatform: PlatformStat[]; totalPosts: number; avgEngagementRate: number }

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<AnalyticsOverview>("/analytics")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-bold text-white">Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">Platform-wide engagement overview</p>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-950 border border-red-800 text-red-400 text-sm">{error}</div>}

      {!data && !error && <div className="text-sm text-gray-500">Loading…</div>}

      {data && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Total posts</p>
              <p className="text-2xl font-bold text-white">{data.totalPosts ?? "—"}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Avg engagement rate</p>
              <p className="text-2xl font-bold text-white">
                {data.avgEngagementRate != null ? `${(data.avgEngagementRate * 100).toFixed(1)}%` : "—"}
              </p>
            </div>
          </div>

          {data.byPlatform && data.byPlatform.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-800 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-gray-400" />
                <h2 className="text-sm font-semibold text-white">By platform</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Platform</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Posts</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Avg engagement</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byPlatform.map((p) => (
                    <tr key={p.platform} className="border-b border-gray-800 last:border-0">
                      <td className="px-5 py-3 text-white capitalize">{p.platform}</td>
                      <td className="px-5 py-3 text-gray-300">{p.postCount}</td>
                      <td className="px-5 py-3 text-gray-300">
                        {p.avgEngagement != null ? `${(p.avgEngagement * 100).toFixed(1)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
