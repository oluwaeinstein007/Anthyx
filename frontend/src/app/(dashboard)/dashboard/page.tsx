"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Link from "next/link";
import {
  FileText, Clock, Globe, TrendingUp, ArrowRight,
  CheckCircle2, AlertTriangle,
} from "lucide-react";

interface OverviewData {
  totalPublished: number;
  byPlatform: Record<string, { posts: number; avgRate: number }>;
  recentPosts: Array<{ id: string; contentText: string; platform: string; publishedAt: string }>;
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery<OverviewData>({
    queryKey: ["analytics"],
    queryFn: () => api.get<OverviewData>("/analytics"),
  });

  const { data: pending } = useQuery<unknown[]>({
    queryKey: ["posts-review"],
    queryFn: () => api.get<unknown[]>("/posts/review"),
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded-lg w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-gray-200 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const avgEngagement = (() => {
    if (!data?.byPlatform) return "0%";
    const rates = Object.values(data.byPlatform).map((p) => p.avgRate);
    if (!rates.length) return "0%";
    return ((rates.reduce((a, b) => a + b, 0) / rates.length) * 100).toFixed(2) + "%";
  })();

  const STATS = [
    {
      icon: FileText,
      label: "Posts published",
      value: String(data?.totalPublished ?? 0),
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
    },
    {
      icon: Clock,
      label: "Pending review",
      value: String(pending?.length ?? 0),
      iconBg: pending?.length ? "bg-amber-50" : "bg-gray-50",
      iconColor: pending?.length ? "text-amber-600" : "text-gray-400",
      highlight: !!pending?.length,
    },
    {
      icon: Globe,
      label: "Platforms active",
      value: String(Object.keys(data?.byPlatform ?? {}).length),
      iconBg: "bg-purple-50",
      iconColor: "text-purple-600",
    },
    {
      icon: TrendingUp,
      label: "Avg engagement",
      value: avgEngagement,
      iconBg: "bg-green-50",
      iconColor: "text-green-600",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
        <p className="text-sm text-gray-500 mt-1">Last 30 days across all brands and platforms.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {STATS.map(({ icon: Icon, label, value, iconBg, iconColor, highlight }) => (
          <div
            key={label}
            className={`p-5 rounded-2xl border flex flex-col gap-3 ${
              highlight ? "bg-amber-50 border-amber-200" : "bg-white border-gray-200"
            }`}
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconBg}`}>
              <Icon className={`w-4.5 h-4.5 ${iconColor}`} style={{ width: 18, height: 18 }} />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">{label}</p>
              <p className={`text-2xl font-bold ${highlight ? "text-amber-700" : "text-gray-900"}`}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Review queue CTA */}
      {!!pending?.length && (
        <div className="p-5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800 text-sm">
                {pending.length} post{pending.length !== 1 ? "s" : ""} awaiting review
              </p>
              <p className="text-amber-600 text-xs mt-0.5">
                Approve or veto before they go live.
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/review"
            className="shrink-0 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-xl transition-colors flex items-center gap-1.5"
          >
            Review now <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Platform breakdown */}
      {data?.byPlatform && Object.keys(data.byPlatform).length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-4">By platform</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(data.byPlatform).map(([platform, stats]) => (
              <div key={platform} className="p-4 bg-white border border-gray-200 rounded-2xl">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-700 capitalize">{platform}</p>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    {(stats.avgRate * 100).toFixed(2)}%
                  </span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{stats.posts}</p>
                <p className="text-xs text-gray-400 mt-0.5">posts published</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent posts */}
      {data?.recentPosts && data.recentPosts.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-4">Recent posts</h2>
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100">
            {data.recentPosts.map((post) => (
              <div key={post.id} className="px-5 py-4 flex items-center gap-4">
                <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full capitalize shrink-0">
                  {post.platform}
                </span>
                <p className="text-sm text-gray-700 flex-1 truncate">{post.contentText}</p>
                <div className="flex items-center gap-1.5 shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                  <span className="text-xs text-gray-400">
                    {new Date(post.publishedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!data?.totalPublished && !pending?.length && (
        <div className="text-center py-20 bg-white border border-gray-200 rounded-2xl">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText className="w-7 h-7 text-gray-400" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-2">Nothing published yet</h3>
          <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
            Create a brand, configure an agent, and generate your first content plan to get started.
          </p>
          <Link
            href="/dashboard/brands"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            Create your first brand <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
