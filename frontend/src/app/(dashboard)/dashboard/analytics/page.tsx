"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import {
  BarChart3, Globe, TrendingUp, Trophy, Heart, MessageSquare,
  Eye, Download, Sparkles, X,
} from "lucide-react";

interface AnalyticsData {
  totalPublished: number;
  byPlatform: Record<string, { posts: number; avgRate: number }>;
}

interface PostWithAnalytics {
  id: string;
  platform: string;
  contentText: string;
  publishedAt: string | null;
  analytics: {
    likes: number;
    reposts: number;
    comments: number;
    impressions: number;
    engagementRate: string | null;
  } | null;
}

interface BestPostsResponse {
  posts: PostWithAnalytics[];
}

interface WeeklyPoint {
  week: string;
  likes: number;
  reposts: number;
  comments: number;
  impressions: number;
  posts: number;
}

const PLATFORM_EMOJI: Record<string, string> = {
  x: "𝕏", instagram: "📸", linkedin: "💼", facebook: "📘",
  tiktok: "🎵", discord: "💬", threads: "🧵", bluesky: "🦋",
  mastodon: "🐘", youtube: "▶️", pinterest: "📌",
};

export default function AnalyticsPage() {
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["analytics"],
    queryFn: () => api.get<AnalyticsData>("/analytics"),
  });

  const { data: bestPosts } = useQuery<BestPostsResponse>({
    queryKey: ["analytics-best-posts"],
    queryFn: () => api.get<BestPostsResponse>("/analytics/posts?limit=10"),
  });

  const { data: weekly } = useQuery<WeeklyPoint[]>({
    queryKey: ["analytics-weekly"],
    queryFn: () => api.get<WeeklyPoint[]>("/analytics/weekly?weeks=12"),
  });

  async function getAiInterpretation() {
    setLoadingAi(true);
    setAiSummary(null);
    try {
      const r = await api.post<{ summary: string }>("/analytics/interpret");
      setAiSummary(r.summary);
    } catch {
      setAiSummary("Unable to generate summary. Please try again.");
    } finally {
      setLoadingAi(false);
    }
  }

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

  function downloadCsv() {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/v1";
    window.location.href = `${apiBase}/analytics/export?days=90`;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">Engagement performance across all platforms (last 30 days).</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={getAiInterpretation}
            disabled={loadingAi}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition-colors disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            {loadingAi ? "Analysing…" : "AI Summary"}
          </button>
          <button
            onClick={downloadCsv}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* AI summary banner */}
      {aiSummary && (
        <div className="flex items-start gap-3 p-5 bg-purple-50 border border-purple-200 rounded-2xl">
          <Sparkles className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
          <p className="text-sm text-purple-900 leading-relaxed flex-1">{aiSummary}</p>
          <button onClick={() => setAiSummary(null)} className="text-purple-400 hover:text-purple-700 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

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
          {/* Engagement over time — line chart */}
          {(weekly?.length ?? 0) > 0 && (
            <div className="p-6 bg-white border border-gray-200 rounded-2xl">
              <h2 className="text-sm font-semibold text-gray-900 mb-5">Engagement over time (last 12 weeks)</h2>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={weekly} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="likes" stroke="#f59e0b" strokeWidth={2} dot={false} name="Likes" />
                  <Line type="monotone" dataKey="comments" stroke="#6366f1" strokeWidth={2} dot={false} name="Comments" />
                  <Line type="monotone" dataKey="reposts" stroke="#10b981" strokeWidth={2} dot={false} name="Reposts" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Platform bar charts */}
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

          {/* Best performers table */}
          {(bestPosts?.posts?.length ?? 0) > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
                <Trophy className="w-4 h-4 text-amber-500" />
                <h2 className="text-sm font-semibold text-gray-900">Top performing posts</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">#</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Post</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Platform</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      <div className="flex items-center gap-1"><Heart className="w-3 h-3" />Likes</div>
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      <div className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />Comments</div>
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      <div className="flex items-center gap-1"><Eye className="w-3 h-3" />Impressions</div>
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Engagement</th>
                  </tr>
                </thead>
                <tbody>
                  {bestPosts!.posts.map((post, i) => {
                    const rate = post.analytics?.engagementRate
                      ? `${(parseFloat(post.analytics.engagementRate) * 100).toFixed(2)}%`
                      : "—";
                    return (
                      <tr key={post.id} className="border-b border-gray-100 last:border-0">
                        <td className="px-6 py-3">
                          <span className={`text-xs font-bold ${i === 0 ? "text-amber-500" : i === 1 ? "text-gray-400" : i === 2 ? "text-orange-400" : "text-gray-300"}`}>
                            #{i + 1}
                          </span>
                        </td>
                        <td className="px-6 py-3 max-w-xs">
                          <p className="text-gray-900 line-clamp-2 text-sm">{post.contentText}</p>
                          {post.publishedAt && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              {new Date(post.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-3 capitalize text-gray-600">
                          {PLATFORM_EMOJI[post.platform] ?? ""} {post.platform}
                        </td>
                        <td className="px-6 py-3 text-gray-700">{post.analytics?.likes?.toLocaleString() ?? "—"}</td>
                        <td className="px-6 py-3 text-gray-700">{post.analytics?.comments?.toLocaleString() ?? "—"}</td>
                        <td className="px-6 py-3 text-gray-700">{post.analytics?.impressions?.toLocaleString() ?? "—"}</td>
                        <td className="px-6 py-3">
                          <span className="font-semibold text-green-600">{rate}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
