"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  CheckCircle2, XCircle, Pencil, Sparkles, ClipboardCheck,
  Check, Filter, FlaskConical, X,
} from "lucide-react";

interface Post {
  id: string;
  contentText: string;
  contentHashtags: string[] | null;
  platform: string;
  contentType: string | null;
  scheduledAt: string;
  agentId: string;
  brandProfileId: string;
  suggestedMediaPrompt: string | null;
  status: string;
}

interface Brand { id: string; name: string; }

const VETO_REASONS = [
  "Off-brand tone", "Factual inaccuracy", "Inappropriate content",
  "Wrong platform format", "Timing issue", "Legal concern", "Other",
];

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "bg-pink-50 text-pink-700",
  x: "bg-gray-100 text-gray-700",
  linkedin: "bg-blue-50 text-blue-700",
  facebook: "bg-blue-50 text-blue-600",
  telegram: "bg-sky-50 text-sky-700",
  tiktok: "bg-gray-100 text-gray-700",
  bluesky: "bg-sky-50 text-sky-700",
  threads: "bg-gray-100 text-gray-700",
  reddit: "bg-orange-50 text-orange-700",
};

const CONTENT_TYPES = ["educational", "promotional", "entertaining", "inspirational", "news"];
const PLATFORMS = ["x", "instagram", "linkedin", "facebook", "telegram", "tiktok", "bluesky", "threads", "reddit"];

export default function ReviewQueuePage() {
  const qc = useQueryClient();

  // Filters
  const [filterBrand, setFilterBrand] = useState("");
  const [filterPlatform, setFilterPlatform] = useState("");
  const [filterContentType, setFilterContentType] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Actions
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [vetoId, setVetoId] = useState<string | null>(null);
  const [vetoReason, setVetoReason] = useState("");
  const [bulkMode, setBulkMode] = useState<"approve" | "veto" | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkVetoReason, setBulkVetoReason] = useState("");
  const [abTestId, setAbTestId] = useState<string | null>(null);
  const [abResult, setAbResult] = useState<{ abTestId: string; variantAId: string; variantBId: string } | null>(null);

  const queryParams = new URLSearchParams();
  if (filterBrand) queryParams.set("brandProfileId", filterBrand);
  if (filterPlatform) queryParams.set("platform", filterPlatform);
  if (filterContentType) queryParams.set("contentType", filterContentType);

  const { data: posts = [], isLoading } = useQuery<Post[]>({
    queryKey: ["posts-review", filterBrand, filterPlatform, filterContentType],
    queryFn: () => api.get<Post[]>(`/posts/review?${queryParams.toString()}`),
    refetchInterval: 30_000,
  });

  const { data: brands = [] } = useQuery<Brand[]>({ queryKey: ["brands"], queryFn: () => api.get<Brand[]>("/brands") });

  const approve = useMutation({
    mutationFn: (postId: string) => api.post(`/posts/${postId}/approve`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["posts-review"] }),
  });

  const veto = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.post(`/posts/${id}/veto`, { reason }),
    onSuccess: () => { setVetoId(null); setVetoReason(""); qc.invalidateQueries({ queryKey: ["posts-review"] }); },
  });

  const updatePost = useMutation({
    mutationFn: ({ id, contentText }: { id: string; contentText: string }) => api.put(`/posts/${id}`, { contentText }),
    onSuccess: () => { setEditingId(null); qc.invalidateQueries({ queryKey: ["posts-review"] }); },
  });

  const approveAll = useMutation({
    mutationFn: (postIds: string[]) => api.post("/posts/approve-batch", { postIds }),
    onSuccess: () => { setBulkMode(null); setSelectedIds(new Set()); qc.invalidateQueries({ queryKey: ["posts-review"] }); },
  });

  const vetoAll = useMutation({
    mutationFn: ({ postIds, reason }: { postIds: string[]; reason: string }) =>
      api.post("/posts/veto-batch", { postIds, reason }),
    onSuccess: () => { setBulkMode(null); setSelectedIds(new Set()); setBulkVetoReason(""); qc.invalidateQueries({ queryKey: ["posts-review"] }); },
  });

  const runAbTest = useMutation({
    mutationFn: (postId: string) => api.post<{ abTestId: string; variantAId: string; variantBId: string }>(`/posts/${postId}/ab-test`, {}),
    onSuccess: (data) => { setAbTestId(null); setAbResult(data); },
  });

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const selectAll = () => setSelectedIds(new Set(posts.map((p) => p.id)));
  const clearSelect = () => setSelectedIds(new Set());

  const filtersActive = !!(filterBrand || filterPlatform || filterContentType);

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[...Array(3)].map((_, i) => <div key={i} className="h-40 bg-gray-100 rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Review Queue</h1>
          <p className="text-sm text-gray-500 mt-1">
            {posts.length} post{posts.length !== 1 ? "s" : ""} awaiting review
            {filtersActive && " (filtered)"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowFilters((s) => !s)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl border transition-colors ${
              filtersActive
                ? "bg-green-50 border-green-200 text-green-700"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Filter className="w-4 h-4" />
            {filtersActive ? "Filtered" : "Filter"}
          </button>
          {posts.length > 1 && (
            <>
              <button
                onClick={() => { setBulkMode("approve"); selectAll(); }}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors"
              >
                <Check className="w-4 h-4" /> Approve all
              </button>
              <button
                onClick={() => { setBulkMode("veto"); selectAll(); }}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-colors"
              >
                <XCircle className="w-4 h-4" /> Veto all
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filter bar */}
      {showFilters && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Brand</label>
              <select
                value={filterBrand}
                onChange={(e) => setFilterBrand(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
              >
                <option value="">All brands</option>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Platform</label>
              <select
                value={filterPlatform}
                onChange={(e) => setFilterPlatform(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
              >
                <option value="">All platforms</option>
                {PLATFORMS.map((p) => <option key={p} value={p} className="capitalize">{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Content type</label>
              <select
                value={filterContentType}
                onChange={(e) => setFilterContentType(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
              >
                <option value="">All types</option>
                {CONTENT_TYPES.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
              </select>
            </div>
          </div>
          {filtersActive && (
            <button
              onClick={() => { setFilterBrand(""); setFilterPlatform(""); setFilterContentType(""); }}
              className="mt-3 text-xs text-gray-500 hover:text-gray-800 underline"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Bulk action confirm bar */}
      {bulkMode && selectedIds.size > 0 && (
        <div className={`border rounded-2xl p-4 flex items-center justify-between gap-4 flex-wrap ${bulkMode === "approve" ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200"}`}>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-800">{selectedIds.size} post{selectedIds.size !== 1 ? "s" : ""} selected</span>
            <button onClick={selectAll} className="text-xs text-gray-500 hover:text-gray-700 underline">Select all</button>
            <button onClick={clearSelect} className="text-xs text-gray-500 hover:text-gray-700 underline">Clear</button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {bulkMode === "veto" && (
              <select
                value={bulkVetoReason}
                onChange={(e) => setBulkVetoReason(e.target.value)}
                className="px-3 py-2 border border-red-200 rounded-xl text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-400"
              >
                <option value="">Select reason…</option>
                {VETO_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            )}
            <button
              onClick={() => {
                if (bulkMode === "approve") approveAll.mutate([...selectedIds]);
                else if (bulkVetoReason) vetoAll.mutate({ postIds: [...selectedIds], reason: bulkVetoReason });
              }}
              disabled={bulkMode === "approve" ? approveAll.isPending : (!bulkVetoReason || vetoAll.isPending)}
              className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 ${
                bulkMode === "approve"
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-red-600 hover:bg-red-700 text-white"
              }`}
            >
              {bulkMode === "approve"
                ? (approveAll.isPending ? "Approving…" : `Approve ${selectedIds.size}`)
                : (vetoAll.isPending ? "Vetoing…" : `Veto ${selectedIds.size}`)}
            </button>
            <button onClick={() => { setBulkMode(null); clearSelect(); }} className="px-4 py-2 text-sm border border-gray-200 bg-white hover:bg-gray-50 rounded-xl text-gray-600 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* A/B test result banner */}
      {abResult && (
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-purple-800">A/B test created</p>
            <p className="text-xs text-purple-600 mt-0.5">Test ID: {abResult.abTestId} · Variant B added to queue for review.</p>
          </div>
          <button onClick={() => setAbResult(null)} className="text-purple-400 hover:text-purple-600"><X className="w-4 h-4" /></button>
        </div>
      )}

      {posts.length === 0 ? (
        <div className="text-center py-24">
          <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ClipboardCheck className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">All clear</h2>
          <p className="text-sm text-gray-500">
            {filtersActive ? "No posts match the current filters." : "No posts awaiting review right now."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <div
              key={post.id}
              className={`bg-white border rounded-2xl overflow-hidden shadow-sm transition-colors ${
                selectedIds.has(post.id) ? "border-green-300 ring-1 ring-green-200" : "border-gray-200"
              }`}
            >
              {/* Card header */}
              <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2.5">
                  {bulkMode && (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(post.id)}
                      onChange={() => toggleSelect(post.id)}
                      className="rounded accent-green-600"
                    />
                  )}
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${PLATFORM_COLORS[post.platform] ?? "bg-gray-100 text-gray-700"}`}>
                    {post.platform}
                  </span>
                  {post.contentType && (
                    <span className="text-xs text-gray-400 capitalize">{post.contentType}</span>
                  )}
                  <span className="text-xs text-gray-400">
                    {new Date(post.scheduledAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => { setAbTestId(post.id); }}
                    className="flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-800 px-2.5 py-1.5 rounded-lg hover:bg-purple-50 transition-colors"
                  >
                    <FlaskConical className="w-3 h-3" /> A/B test
                  </button>
                  <button
                    onClick={() => { setEditingId(post.id); setEditText(post.contentText); setVetoId(null); }}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <Pencil className="w-3 h-3" /> Edit
                  </button>
                  <button
                    onClick={() => { setVetoId(post.id); setEditingId(null); }}
                    className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <XCircle className="w-3 h-3" /> Veto
                  </button>
                  <button
                    onClick={() => approve.mutate(post.id)}
                    disabled={approve.isPending}
                    className="flex items-center gap-1.5 text-xs bg-green-600 hover:bg-green-700 text-white px-3.5 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3 h-3" /> Approve
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-5">
                {editingId === post.id ? (
                  <div className="space-y-3">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={4}
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => updatePost.mutate({ id: post.id, contentText: editText })}
                        disabled={updatePost.isPending}
                        className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                      >
                        {updatePost.isPending ? "Saving…" : "Save changes"}
                      </button>
                      <button onClick={() => setEditingId(null)} className="px-4 py-2 text-sm border border-gray-200 hover:bg-gray-50 rounded-xl text-gray-600 transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{post.contentText}</p>
                )}

                {post.contentHashtags && post.contentHashtags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {post.contentHashtags.map((tag) => (
                      <span key={tag} className="text-xs text-blue-500 hover:text-blue-700 font-medium">#{tag}</span>
                    ))}
                  </div>
                )}

                {post.suggestedMediaPrompt && (
                  <div className="mt-3 flex items-start gap-2.5 p-3 bg-purple-50 rounded-xl border border-purple-100">
                    <Sparkles className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-purple-700 mb-0.5">AI image prompt</p>
                      <p className="text-xs text-purple-600 leading-relaxed">{post.suggestedMediaPrompt}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* A/B test confirm */}
              {abTestId === post.id && (
                <div className="px-5 pb-5 pt-4 border-t border-purple-100 bg-purple-50 space-y-3">
                  <p className="text-sm font-medium text-purple-800">Generate an A/B variant for this post?</p>
                  <p className="text-xs text-purple-600">The AI will create a second version with a different hook/angle. Both will appear in the review queue.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => runAbTest.mutate(post.id)}
                      disabled={runAbTest.isPending}
                      className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                    >
                      {runAbTest.isPending ? "Generating variant…" : "Generate variant B"}
                    </button>
                    <button onClick={() => setAbTestId(null)} className="px-4 py-2 text-sm border border-purple-200 bg-white hover:bg-purple-50 rounded-xl text-purple-600 transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Veto panel */}
              {vetoId === post.id && (
                <div className="px-5 pb-5 pt-4 border-t border-red-100 bg-red-50 space-y-3">
                  <p className="text-sm font-medium text-red-800">Select a reason for vetoing:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {VETO_REASONS.map((r) => (
                      <button
                        key={r}
                        onClick={() => setVetoReason(r)}
                        className={`text-xs px-3 py-1.5 rounded-xl border font-medium transition-colors ${
                          vetoReason === r
                            ? "bg-red-600 text-white border-red-600"
                            : "border-red-200 bg-white text-red-600 hover:bg-red-100"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => vetoReason && veto.mutate({ id: post.id, reason: vetoReason })}
                      disabled={!vetoReason || veto.isPending}
                      className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                    >
                      {veto.isPending ? "Vetoing…" : "Confirm veto"}
                    </button>
                    <button onClick={() => { setVetoId(null); setVetoReason(""); }} className="px-4 py-2 text-sm border border-red-200 bg-white hover:bg-red-50 rounded-xl text-red-600 transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
