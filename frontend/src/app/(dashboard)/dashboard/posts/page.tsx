"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Link from "next/link";
import {
  ListChecks,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Send,
  FileEdit,
  Filter,
  BarChart3,
} from "lucide-react";

interface Post {
  id: string;
  platform: string;
  contentText: string;
  status: string;
  scheduledAt: string;
  publishedAt: string | null;
  brandProfileId: string;
  agentId: string;
  contentType: string | null;
  errorMessage: string | null;
  analytics?: {
    likes: number;
    reposts: number;
    comments: number;
    impressions: number;
    engagementRate: string | null;
  } | null;
}

interface PostsResponse {
  posts: Post[];
  total: number;
  limit: number;
  offset: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.FC<{ className?: string }> }> = {
  draft:          { label: "Draft",          color: "bg-gray-100 text-gray-600",      icon: FileEdit },
  pending_review: { label: "Pending review", color: "bg-yellow-100 text-yellow-700",  icon: Clock },
  approved:       { label: "Approved",       color: "bg-blue-100 text-blue-700",      icon: CheckCircle2 },
  scheduled:      { label: "Scheduled",      color: "bg-purple-100 text-purple-700",  icon: Clock },
  published:      { label: "Published",      color: "bg-green-100 text-green-700",    icon: Send },
  failed:         { label: "Failed",         color: "bg-red-100 text-red-700",        icon: AlertCircle },
  vetoed:         { label: "Vetoed",         color: "bg-red-100 text-red-700",        icon: XCircle },
  silenced:       { label: "Silenced",       color: "bg-gray-100 text-gray-500",      icon: XCircle },
};

const PLATFORM_EMOJI: Record<string, string> = {
  x: "𝕏", instagram: "📸", linkedin: "💼", facebook: "📘",
  tiktok: "🎵", twitter: "𝕏", discord: "💬", slack: "💬",
  threads: "🧵", bluesky: "🦋", mastodon: "🐘", youtube: "▶️",
  pinterest: "📌", email: "✉️",
};

const ALL_STATUSES = ["", "draft", "pending_review", "approved", "scheduled", "published", "failed", "vetoed"];
const STATUS_LABELS: Record<string, string> = {
  "": "All", draft: "Draft", pending_review: "Pending review",
  approved: "Approved", scheduled: "Scheduled", published: "Published",
  failed: "Failed", vetoed: "Vetoed",
};

const LIMIT = 50;

export default function PostsPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [offset, setOffset] = useState(0);

  const { data, isLoading } = useQuery<PostsResponse>({
    queryKey: ["posts-list", statusFilter, offset],
    queryFn: () => {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(offset) });
      if (statusFilter) params.set("status", statusFilter);
      return api.get<PostsResponse>(`/posts?${params}`);
    },
  });

  const posts = data?.posts ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Posts</h1>
          <p className="text-sm text-gray-500 mt-1">All scheduled and published posts across your agents</p>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-gray-400" />
        {ALL_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setOffset(0); }}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
              statusFilter === s
                ? "bg-gray-900 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-2xl" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-dashed border-gray-200 rounded-2xl">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
            <ListChecks className="w-7 h-7 text-gray-400" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">No posts found</h3>
          <p className="text-sm text-gray-500">
            {statusFilter ? `No posts with status "${STATUS_LABELS[statusFilter]}"` : "Generate a plan to start creating posts"}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Post</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Platform</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Scheduled</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Engagement</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => {
                const statusCfg = STATUS_CONFIG[post.status] ?? STATUS_CONFIG["draft"]!;
                const StatusIcon = statusCfg.icon;
                const engRate = post.analytics?.engagementRate
                  ? `${(parseFloat(post.analytics.engagementRate) * 100).toFixed(2)}%`
                  : null;

                return (
                  <tr key={post.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 max-w-xs">
                      <p className="text-gray-900 line-clamp-2 text-sm leading-snug">{post.contentText}</p>
                      {post.contentType && (
                        <span className="text-xs text-gray-400 capitalize mt-0.5 block">{post.contentType}</span>
                      )}
                      {post.errorMessage && (
                        <p className="text-xs text-red-500 mt-0.5 line-clamp-1">{post.errorMessage}</p>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className="capitalize text-gray-700">
                        {PLATFORM_EMOJI[post.platform] ?? ""} {post.platform}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${statusCfg.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusCfg.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500 whitespace-nowrap">
                      {post.publishedAt
                        ? new Date(post.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : new Date(post.scheduledAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-5 py-3">
                      {engRate ? (
                        <div className="flex items-center gap-1.5">
                          <BarChart3 className="w-3.5 h-3.5 text-green-500" />
                          <span className="text-sm font-medium text-gray-900">{engRate}</span>
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination */}
          {(posts.length === LIMIT || offset > 0) && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 text-xs text-gray-500">
              <button
                onClick={() => setOffset(Math.max(0, offset - LIMIT))}
                disabled={offset === 0}
                className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                ← Previous
              </button>
              <span>Showing {offset + 1}–{offset + posts.length}</span>
              <button
                onClick={() => setOffset(offset + LIMIT)}
                disabled={posts.length < LIMIT}
                className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
