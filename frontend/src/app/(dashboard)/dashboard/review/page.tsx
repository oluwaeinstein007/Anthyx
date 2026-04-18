"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { CheckCircle2, XCircle, Pencil, Sparkles, ClipboardCheck, Check } from "lucide-react";

interface Post {
  id: string;
  contentText: string;
  contentHashtags: string[] | null;
  platform: string;
  scheduledAt: string;
  agentId: string;
  suggestedMediaPrompt: string | null;
  status: string;
}

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
};

export default function ReviewQueuePage() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [vetoId, setVetoId] = useState<string | null>(null);
  const [vetoReason, setVetoReason] = useState("");
  const [bulkConfirm, setBulkConfirm] = useState(false);

  const { data: posts = [], isLoading } = useQuery<Post[]>({
    queryKey: ["posts-review"],
    queryFn: () => api.get<Post[]>("/posts/review"),
    refetchInterval: 30_000,
  });

  const approve = useMutation({
    mutationFn: (postId: string) => api.post(`/posts/${postId}/approve`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["posts-review"] }),
  });

  const veto = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/posts/${id}/veto`, { reason }),
    onSuccess: () => { setVetoId(null); setVetoReason(""); qc.invalidateQueries({ queryKey: ["posts-review"] }); },
  });

  const updatePost = useMutation({
    mutationFn: ({ id, contentText }: { id: string; contentText: string }) =>
      api.put(`/posts/${id}`, { contentText }),
    onSuccess: () => { setEditingId(null); qc.invalidateQueries({ queryKey: ["posts-review"] }); },
  });

  const approveAll = useMutation({
    mutationFn: () => api.post("/posts/approve-batch", { postIds: posts.map((p) => p.id) }),
    onSuccess: () => { setBulkConfirm(false); qc.invalidateQueries({ queryKey: ["posts-review"] }); },
  });

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[...Array(3)].map((_, i) => <div key={i} className="h-40 bg-gray-100 rounded-2xl" />)}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-24">
        <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <ClipboardCheck className="w-8 h-8 text-green-500" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">All clear</h2>
        <p className="text-sm text-gray-500">No posts awaiting review right now.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Review Queue</h1>
          <p className="text-sm text-gray-500 mt-1">
            {posts.length} post{posts.length !== 1 ? "s" : ""} awaiting your review
          </p>
        </div>
        {posts.length > 1 && (
          !bulkConfirm ? (
            <button
              onClick={() => setBulkConfirm(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors"
            >
              <Check className="w-4 h-4" /> Approve all {posts.length}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Approve all {posts.length} posts?</span>
              <button
                onClick={() => approveAll.mutate()}
                disabled={approveAll.isPending}
                className="px-3.5 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                {approveAll.isPending ? "Approving…" : "Confirm"}
              </button>
              <button onClick={() => setBulkConfirm(false)} className="px-3.5 py-2 text-sm border border-gray-200 bg-white hover:bg-gray-50 rounded-xl text-gray-600 transition-colors">
                Cancel
              </button>
            </div>
          )
        )}
      </div>

      <div className="space-y-4">
        {posts.map((post) => (
          <div key={post.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            {/* Card header */}
            <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${PLATFORM_COLORS[post.platform] ?? "bg-gray-100 text-gray-700"}`}>
                  {post.platform}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(post.scheduledAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                </span>
              </div>
              <div className="flex items-center gap-2">
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
                    <span key={tag} className="text-xs text-blue-500 hover:text-blue-700 font-medium">
                      #{tag}
                    </span>
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
    </div>
  );
}
