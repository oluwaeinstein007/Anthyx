"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  ListChecks, CheckCircle2, XCircle, Clock, AlertCircle, Send,
  FileEdit, Filter, BarChart3, X, ZoomIn, Heart, MessageCircle,
  Repeat2, Eye, Play,
} from "lucide-react";

interface Post {
  id: string;
  platform: string;
  contentText: string;
  contentHashtags: string[] | null;
  status: string;
  scheduledAt: string;
  publishedAt: string | null;
  brandProfileId: string;
  agentId: string;
  contentType: string | null;
  errorMessage: string | null;
  mediaUrls: string[] | null;
  suggestedMediaPrompt: string | null;
  reviewNotes: string | null;
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

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "bg-pink-50 text-pink-700 border-pink-200",
  x: "bg-gray-100 text-gray-700 border-gray-200",
  twitter: "bg-gray-100 text-gray-700 border-gray-200",
  linkedin: "bg-blue-50 text-blue-700 border-blue-200",
  facebook: "bg-blue-50 text-blue-600 border-blue-200",
  telegram: "bg-sky-50 text-sky-700 border-sky-200",
  tiktok: "bg-gray-900 text-white border-gray-800",
  bluesky: "bg-sky-50 text-sky-700 border-sky-200",
  threads: "bg-gray-100 text-gray-700 border-gray-200",
  youtube: "bg-red-50 text-red-700 border-red-200",
  pinterest: "bg-red-50 text-red-600 border-red-200",
  mastodon: "bg-purple-50 text-purple-700 border-purple-200",
  reddit: "bg-orange-50 text-orange-700 border-orange-200",
};

// Per-platform preferred media aspect ratios (CSS aspect-ratio values)
const PLATFORM_MEDIA_ASPECT: Record<string, string> = {
  instagram: "aspect-[4/5]",    // portrait feed standard
  tiktok:    "aspect-[9/16]",   // full vertical
  youtube:   "aspect-[16/9]",   // landscape
  pinterest: "aspect-[2/3]",    // tall portrait
  linkedin:  "aspect-[16/9]",
  facebook:  "aspect-[16/9]",
  x:         "aspect-[16/9]",
  twitter:   "aspect-[16/9]",
  threads:   "aspect-[4/5]",
  bluesky:   "aspect-[16/9]",
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

function isVideo(url: string) {
  return /\.(mp4|mov|webm|m4v|avi)(\?|$)/i.test(url);
}

function renderLinkedContent(text: string) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((part, i) =>
    /^https?:\/\//.test(part)
      ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700 underline break-all">{part}</a>
      : <span key={i}>{part}</span>
  );
}

// ── Lightbox ────────────────────────────────────────────────────────────────
function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white bg-white/10 rounded-full p-2 z-10">
        <X className="w-5 h-5" />
      </button>
      {isVideo(src) ? (
        <video
          src={src}
          controls
          autoPlay
          className="max-w-full max-h-[90vh] rounded-xl shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <img
          src={src}
          alt="Post media"
          className="max-w-full max-h-[90vh] rounded-xl object-contain shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </div>
  );
}

// ── Media grid — platform-aware ──────────────────────────────────────────────
function MediaGrid({ urls, platform, onClickUrl }: { urls: string[]; platform: string; onClickUrl: (url: string) => void }) {
  const aspect = PLATFORM_MEDIA_ASPECT[platform] ?? "aspect-[16/9]";

  if (urls.length === 1) {
    const url = urls[0]!;
    return (
      <div className={`relative group cursor-zoom-in w-full ${aspect} overflow-hidden rounded-xl border border-gray-200 bg-black`} onClick={() => onClickUrl(url)}>
        {isVideo(url) ? (
          <>
            <video src={url} className="w-full h-full object-cover" muted playsInline />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
              <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Play className="w-5 h-5 text-white fill-white ml-0.5" />
              </div>
            </div>
          </>
        ) : (
          <>
            <img src={url} alt="Post media" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-colors">
              <ZoomIn className="w-7 h-7 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
            </div>
          </>
        )}
        {isVideo(url) && (
          <span className="absolute top-2 left-2 text-xs font-semibold bg-black/60 text-white px-2 py-0.5 rounded-full">VIDEO</span>
        )}
      </div>
    );
  }

  // Multi-image grid (up to 4, Instagram carousel / X multi-photo style)
  const display = urls.slice(0, 4);
  const cols = display.length === 2 ? "grid-cols-2" : display.length === 3 ? "grid-cols-3" : "grid-cols-2";
  const rows = display.length >= 3 ? "grid-rows-2" : "grid-rows-1";

  return (
    <div className={`grid ${cols} ${rows} gap-1 rounded-xl overflow-hidden border border-gray-200`} style={{ aspectRatio: "16/9" }}>
      {display.map((url, i) => (
        <div
          key={i}
          className={`relative group cursor-zoom-in overflow-hidden bg-black ${display.length === 3 && i === 0 ? "row-span-2" : ""}`}
          onClick={() => onClickUrl(url)}
        >
          {isVideo(url) ? (
            <>
              <video src={url} className="w-full h-full object-cover" muted playsInline />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <Play className="w-5 h-5 text-white fill-white" />
              </div>
            </>
          ) : (
            <>
              <img src={url} alt={`Media ${i + 1}`} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
              </div>
            </>
          )}
          {urls.length > 4 && i === 3 && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <span className="text-white text-xl font-bold">+{urls.length - 4}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Post detail modal ────────────────────────────────────────────────────────
function PostDetailModal({ post, onClose }: { post: Post; onClose: () => void }) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const statusCfg = STATUS_CONFIG[post.status] ?? STATUS_CONFIG["draft"]!;
  const StatusIcon = statusCfg.icon;
  const platformColor = PLATFORM_COLORS[post.platform] ?? "bg-gray-100 text-gray-700 border-gray-200";
  const hasMedia = post.mediaUrls && post.mediaUrls.length > 0;

  const engRate = post.analytics?.engagementRate
    ? `${(parseFloat(post.analytics.engagementRate) * 100).toFixed(2)}%`
    : null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
        <div
          className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-2xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize border ${platformColor}`}>
                {PLATFORM_EMOJI[post.platform] ?? ""} {post.platform}
              </span>
              {post.contentType && (
                <span className="text-xs text-gray-500 capitalize bg-gray-100 px-2 py-0.5 rounded-full">{post.contentType}</span>
              )}
              <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${statusCfg.color}`}>
                <StatusIcon className="w-3 h-3" />
                {statusCfg.label}
              </span>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-5">
            {/* Media */}
            {hasMedia && (
              <MediaGrid
                urls={post.mediaUrls!}
                platform={post.platform}
                onClickUrl={setLightboxSrc}
              />
            )}

            {/* Post text */}
            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap select-text">
              {renderLinkedContent(post.contentText)}
            </p>

            {/* Hashtags */}
            {post.contentHashtags && post.contentHashtags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {post.contentHashtags.map((tag) => (
                  <span key={tag} className="text-xs text-blue-500 font-medium hover:text-blue-700">#{tag}</span>
                ))}
              </div>
            )}

            {/* Error message */}
            {post.errorMessage && (
              <div className="flex items-start gap-2 p-3 bg-red-50 rounded-xl border border-red-100">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-600 leading-relaxed">{post.errorMessage}</p>
              </div>
            )}

            {/* Review notes */}
            {post.reviewNotes && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                <p className="text-xs text-amber-700"><span className="font-medium">Review note:</span> {post.reviewNotes}</p>
              </div>
            )}

            {/* Schedule / publish info */}
            <div className="flex items-center gap-4 text-xs text-gray-500 border-t border-gray-100 pt-4 flex-wrap">
              <span>
                {post.publishedAt
                  ? <>Published <span className="font-medium text-gray-700">{new Date(post.publishedAt).toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" })}</span></>
                  : <>Scheduled <span className="font-medium text-gray-700">{new Date(post.scheduledAt).toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" })}</span></>
                }
              </span>
            </div>

            {/* Analytics */}
            {post.analytics && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border border-gray-100 rounded-2xl p-4 bg-gray-50">
                <div className="flex flex-col items-center gap-1">
                  <Heart className="w-4 h-4 text-red-400" />
                  <span className="text-base font-semibold text-gray-800">{post.analytics.likes.toLocaleString()}</span>
                  <span className="text-xs text-gray-500">Likes</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <Repeat2 className="w-4 h-4 text-green-500" />
                  <span className="text-base font-semibold text-gray-800">{post.analytics.reposts.toLocaleString()}</span>
                  <span className="text-xs text-gray-500">Reposts</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <MessageCircle className="w-4 h-4 text-blue-400" />
                  <span className="text-base font-semibold text-gray-800">{post.analytics.comments.toLocaleString()}</span>
                  <span className="text-xs text-gray-500">Comments</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <Eye className="w-4 h-4 text-purple-400" />
                  <span className="text-base font-semibold text-gray-800">{post.analytics.impressions.toLocaleString()}</span>
                  <span className="text-xs text-gray-500">Impressions</span>
                </div>
                {engRate && (
                  <div className="col-span-2 sm:col-span-4 flex items-center justify-center gap-2 pt-2 border-t border-gray-200 mt-1">
                    <BarChart3 className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-semibold text-gray-800">{engRate} engagement rate</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    </>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function PostsPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

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
      {selectedPost && <PostDetailModal post={selectedPost} onClose={() => setSelectedPost(null)} />}

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
                const hasMedia = post.mediaUrls && post.mediaUrls.length > 0;
                const hasVideo = hasMedia && post.mediaUrls!.some(isVideo);

                return (
                  <tr
                    key={post.id}
                    onClick={() => setSelectedPost(post)}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3 max-w-xs">
                      <div className="flex items-start gap-3">
                        {/* Thumbnail for posts with media */}
                        {hasMedia && (
                          <div className="shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 relative">
                            {hasVideo ? (
                              <>
                                <video src={post.mediaUrls![0]} className="w-full h-full object-cover" muted playsInline />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                  <Play className="w-3 h-3 text-white fill-white" />
                                </div>
                              </>
                            ) : (
                              <img src={post.mediaUrls![0]} alt="" className="w-full h-full object-cover" />
                            )}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-gray-900 line-clamp-2 text-sm leading-snug">{post.contentText}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {post.contentType && (
                              <span className="text-xs text-gray-400 capitalize">{post.contentType}</span>
                            )}
                            {hasMedia && (
                              <span className="text-xs text-gray-400">
                                {hasVideo ? "· video" : `· ${post.mediaUrls!.length} image${post.mediaUrls!.length > 1 ? "s" : ""}`}
                              </span>
                            )}
                          </div>
                          {post.errorMessage && (
                            <p className="text-xs text-red-500 mt-0.5 line-clamp-1">{post.errorMessage}</p>
                          )}
                        </div>
                      </div>
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
