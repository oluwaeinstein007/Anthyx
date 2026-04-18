"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { BarChart3, Globe, TrendingUp } from "lucide-react";

interface AnalyticsData {
  totalPublished: number;
  byPlatform: Record<string, { posts: number; avgRate: number }>;
}

export default function AnalyticsPage() {
  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["analytics"],
    queryFn: () => api.get<AnalyticsData>("/analytics"),
  });

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-gray-200 rounded-lg w-40" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-28 bg-gray-100 rounded-2xl" />
          <div className="h-28 bg-gray-100 rounded-2xl" />
        </div>
        <div className="h-72 bg-gray-100 rounded-2xl" />
      </div>
    );
  }

  const chartData = Object.entries(data?.byPlatform ?? {}).map(([platform, stats]) => ({
    platform,
    posts: stats.posts,
    engagement: parseFloat((stats.avgRate * 100).toFixed(2)),
  }));

  const avgEngagement = chartData.length
    ? (chartData.reduce((s, d) => s + d.engagement, 0) / chartData.length).toFixed(2)
    : "0";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">Engagement performance across all platforms (last 30 days).</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-white border border-gray-200 rounded-2xl flex items-start gap-4">
          <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
            <BarChart3 className="w-4.5 h-4.5 text-blue-600" style={{ width: 18, height: 18 }} />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Total published</p>
            <p className="text-2xl font-bold text-gray-900">{data?.totalPublished ?? 0}</p>
          </div>
        </div>
        <div className="p-5 bg-white border border-gray-200 rounded-2xl flex items-start gap-4">
          <div className="w-9 h-9 bg-purple-50 rounded-xl flex items-center justify-center shrink-0">
            <Globe className="w-4.5 h-4.5 text-purple-600" style={{ width: 18, height: 18 }} />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Active platforms</p>
            <p className="text-2xl font-bold text-gray-900">{Object.keys(data?.byPlatform ?? {}).length}</p>
          </div>
        </div>
        <div className="p-5 bg-white border border-gray-200 rounded-2xl flex items-start gap-4">
          <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center shrink-0">
            <TrendingUp className="w-4.5 h-4.5 text-green-600" style={{ width: 18, height: 18 }} />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Avg engagement</p>
            <p className="text-2xl font-bold text-gray-900">{avgEngagement}%</p>
          </div>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="text-center py-20 bg-white border border-dashed border-gray-200 rounded-2xl">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-7 h-7 text-gray-400" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">No data yet</h3>
          <p className="text-sm text-gray-500">Publish posts to start seeing engagement analytics here.</p>
        </div>
      ) : (
        <div className="grid gap-6">
          <div className="p-6 bg-white border border-gray-200 rounded-2xl">
            <h2 className="text-sm font-semibold text-gray-900 mb-5">Posts published by platform</h2>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} barSize={36}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="platform" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                  cursor={{ fill: "#f8fafc" }}
                />
                <Bar dataKey="posts" fill="#16a34a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="p-6 bg-white border border-gray-200 rounded-2xl">
            <h2 className="text-sm font-semibold text-gray-900 mb-5">Avg engagement rate by platform (%)</h2>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} barSize={36}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="platform" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: number) => [`${v}%`, "Engagement"]}
                  contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                  cursor={{ fill: "#f8fafc" }}
                />
                <Bar dataKey="engagement" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
