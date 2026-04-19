"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Link from "next/link";
import { Trash2, Pencil, Check, X } from "lucide-react";

interface ScheduledPost {
  id: string;
  platform: string;
  scheduledAt: string;
  status: string;
  caption: string | null;
  contentText: string | null;
  contentHashtags: string[] | null;
  hashtags: string[] | null;
  mediaUrls: string[] | null;
  socialAccountId: string | null;
}

interface MarketingPlan {
  id: string;
  name: string;
  status: string;
  startDate: string;
  endDate: string;
  goals: string[];
  posts: ScheduledPost[];
}

const STATUS_DOT: Record<string, string> = {
  draft: "bg-gray-300",
  approved: "bg-blue-400",
  scheduled: "bg-amber-400",
  published: "bg-green-500",
  failed: "bg-red-500",
  silenced: "bg-red-300",
  vetoed: "bg-red-400",
  pending_review: "bg-orange-400",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_review: "Pending review",
  approved: "Approved",
  scheduled: "Scheduled",
  published: "Published",
  failed: "Failed",
  silenced: "Silenced",
  vetoed: "Vetoed",
};

const PLAN_STATUS_STYLES: Record<string, string> = {
  generating: "bg-blue-100 text-blue-700",
  pending_review: "bg-amber-100 text-amber-700",
  active: "bg-green-100 text-green-700",
  completed: "bg-gray-100 text-gray-600",
  paused: "bg-red-100 text-red-700",
};

type ViewMode = "calendar" | "list";

function getDaysInRange(start: string, end: string): Date[] {
  const days: Date[] = [];
  const current = new Date(start);
  const last = new Date(end);
  while (current <= last) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

const EDITABLE_STATUSES = new Set(["draft", "pending_review", "approved", "scheduled"]);

export default function PlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [view, setView] = useState<ViewMode>("calendar");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Per-post edit state
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editHashtags, setEditHashtags] = useState("");

  const { data: plan, isLoading } = useQuery<MarketingPlan>({
    queryKey: ["plan", id],
    queryFn: () => api.get<MarketingPlan>(`/plans/${id}`),
    refetchInterval: 15_000,
  });

  const approve = useMutation({
    mutationFn: () => api.post(`/plans/${id}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plan", id] }),
  });

  const pause = useMutation({
    mutationFn: () => api.post(`/plans/${id}/pause`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plan", id] }),
  });

  const resume = useMutation({
    mutationFn: () => api.post(`/plans/${id}/resume`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plan", id] }),
  });

  const deletePlan = useMutation({
    mutationFn: () => api.delete(`/plans/${id}`),
    onSuccess: () => router.push("/dashboard/plans"),
  });

  const generateContent = useMutation({
    mutationFn: () => api.post(`/plans/${id}/generate-content`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plan", id] }),
  });

  const updatePost = useMutation({
    mutationFn: ({ postId, body }: { postId: string; body: Record<string, unknown> }) =>
      api.put(`/posts/${postId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plan", id] });
      setEditingPostId(null);
    },
  });

  function startEdit(post: ScheduledPost) {
    setEditingPostId(post.id);
    setEditText(post.contentText ?? post.caption ?? "");
    setEditHashtags((post.contentHashtags ?? post.hashtags ?? []).join(", "));
  }

  function saveEdit(postId: string) {
    const hashtags = editHashtags
      .split(",")
      .map((h) => h.trim().replace(/^#/, ""))
      .filter(Boolean);
    updatePost.mutate({
      postId,
      body: {
        contentText: editText,
        ...(hashtags.length > 0 && { contentHashtags: hashtags }),
      },
    });
  }

  if (isLoading)
    return <div className="text-sm text-gray-500 animate-pulse">Loading plan...</div>;
  if (!plan) return <div className="text-sm text-gray-500">Plan not found.</div>;

  const days = getDaysInRange(plan.startDate, plan.endDate);
  const postsByDay: Record<string, ScheduledPost[]> = {};
  for (const post of plan.posts) {
    const dayKey = new Date(post.scheduledAt).toISOString().split("T")[0]!;
    if (!postsByDay[dayKey]) postsByDay[dayKey] = [];
    postsByDay[dayKey].push(post);
  }

  const publishedCount = plan.posts.filter((p) => p.status === "published").length;
  const approvedCount = plan.posts.filter((p) => ["approved", "scheduled"].includes(p.status)).length;
  const pendingReviewCount = plan.posts.filter((p) => p.status === "pending_review").length;
  const failedCount = plan.posts.filter((p) => p.status === "failed").length;
  const draftCount = plan.posts.filter((p) => p.status === "draft").length;

  const canEdit = !["generating", "completed"].includes(plan.status);

  return (
    <div className="space-y-6">
      {/* Delete confirmation modal */}
      {showDeleteConfirm && (() => {
        const scheduledCount = plan.posts.filter((p) => ["approved", "scheduled"].includes(p.status)).length;
        const isActivePlan = plan.status === "active";
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-4 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Delete "{plan.name}"?</h3>
                  <p className="text-sm text-gray-500 mt-0.5">This action cannot be undone.</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-3 space-y-1 text-sm">
                <p className="text-gray-700 font-medium">This will permanently delete:</p>
                <ul className="text-gray-500 space-y-0.5 pl-3">
                  <li>• {plan.posts.length} post{plan.posts.length !== 1 ? "s" : ""} total</li>
                  {scheduledCount > 0 && (
                    <li className="text-amber-600 font-medium">
                      • {scheduledCount} approved/scheduled post{scheduledCount !== 1 ? "s" : ""} (publishing jobs will be cancelled)
                    </li>
                  )}
                </ul>
              </div>

              {isActivePlan && scheduledCount > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700">
                  This plan is <strong>active</strong> — {scheduledCount} post{scheduledCount !== 1 ? "s are" : " is"} queued to publish. Deleting will cancel all of them.
                </div>
              )}

              <div className="flex gap-2 justify-end pt-1">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  Keep plan
                </button>
                <button
                  onClick={() => deletePlan.mutate()}
                  disabled={deletePlan.isPending}
                  className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium"
                >
                  {deletePlan.isPending ? "Deleting…" : "Yes, delete plan"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/dashboard/plans"
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              ← Plans
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{plan.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date(plan.startDate).toLocaleDateString()} –{" "}
            {new Date(plan.endDate).toLocaleDateString()}
          </p>
          {plan.goals.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {plan.goals.map((goal, i) => (
                <span
                  key={i}
                  className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"
                >
                  {goal}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              PLAN_STATUS_STYLES[plan.status] ?? "bg-gray-100 text-gray-600"
            }`}
          >
            {plan.status.replace("_", " ")}
          </span>

          {plan.status === "pending_review" && (
            <button
              onClick={() => approve.mutate()}
              disabled={approve.isPending}
              className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {approve.isPending ? "Approving..." : "Approve plan"}
            </button>
          )}
          {plan.status === "active" && (
            <button
              onClick={() => pause.mutate()}
              disabled={pause.isPending}
              className="px-3 py-1.5 border border-red-200 text-red-600 text-xs font-medium rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              {pause.isPending ? "Pausing..." : "Pause plan"}
            </button>
          )}
          {plan.status === "paused" && (
            <button
              onClick={() => resume.mutate()}
              disabled={resume.isPending}
              className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {resume.isPending ? "Resuming..." : "Resume plan"}
            </button>
          )}

          {/* Delete — available for any status except while generating */}
          {plan.status !== "generating" && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
              title="Delete plan"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-5 gap-3">
        <div className="p-4 bg-white border border-gray-200 rounded-xl text-center">
          <p className="text-2xl font-bold text-green-600">{publishedCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Published</p>
        </div>
        <div className="p-4 bg-white border border-gray-200 rounded-xl text-center">
          <p className="text-2xl font-bold text-blue-600">{approvedCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Approved</p>
        </div>
        <div className="p-4 bg-white border border-gray-200 rounded-xl text-center">
          <p className="text-2xl font-bold text-amber-600">{pendingReviewCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Pending review</p>
        </div>
        <div className="p-4 bg-white border border-gray-200 rounded-xl text-center">
          <p className="text-2xl font-bold text-red-500">{failedCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Failed</p>
        </div>
        <div className="p-4 bg-white border border-gray-200 rounded-xl text-center">
          <p className="text-2xl font-bold text-gray-500">{draftCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Draft</p>
        </div>
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-2">
        {(["calendar", "list"] as ViewMode[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors capitalize ${
              view === v
                ? "bg-gray-900 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {v}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-4">
          {draftCount > 0 && (
            <button
              onClick={() => generateContent.mutate()}
              disabled={generateContent.isPending}
              className="text-xs text-green-600 hover:underline disabled:opacity-50"
            >
              {generateContent.isPending
                ? "Queuing…"
                : `Generate content for ${draftCount} draft${draftCount !== 1 ? "s" : ""} →`}
            </button>
          )}
          {pendingReviewCount > 0 && (
            <Link href="/dashboard/review" className="text-xs text-amber-600 hover:underline">
              {pendingReviewCount} post{pendingReviewCount !== 1 ? "s" : ""} need review →
            </Link>
          )}
        </div>
      </div>

      {/* Calendar view */}
      {view === "calendar" && (
        <div className="space-y-1">
          {days.map((day) => {
            const key = day.toISOString().split("T")[0]!;
            const dayPosts = postsByDay[key] ?? [];
            const isToday = key === new Date().toISOString().split("T")[0];

            return (
              <div
                key={key}
                className={`flex gap-3 p-3 rounded-xl ${
                  isToday ? "bg-green-50 border border-green-200" : "bg-white border border-gray-100"
                }`}
              >
                <div className="w-20 shrink-0">
                  <p
                    className={`text-xs font-semibold ${
                      isToday ? "text-green-700" : "text-gray-500"
                    }`}
                  >
                    {day.toLocaleDateString("en-US", { weekday: "short" })}
                  </p>
                  <p
                    className={`text-sm font-bold ${
                      isToday ? "text-green-800" : "text-gray-800"
                    }`}
                  >
                    {day.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                </div>

                <div className="flex-1 min-w-0">
                  {dayPosts.length === 0 ? (
                    <p className="text-xs text-gray-300 italic">No posts</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {dayPosts.map((post) => (
                        <div
                          key={post.id}
                          className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs shadow-sm"
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              STATUS_DOT[post.status] ?? "bg-gray-300"
                            }`}
                          />
                          <span className="capitalize font-medium text-gray-700">
                            {post.platform}
                          </span>
                          {!post.socialAccountId && (
                            <span
                              className="text-orange-400"
                              title="No account linked — connect this platform to enable publishing"
                            >
                              ⚠
                            </span>
                          )}
                          <span className="text-gray-400">
                            {new Date(post.scheduledAt).toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </span>
                          <span className="text-gray-300">·</span>
                          <span
                            className={`${
                              post.status === "published"
                                ? "text-green-600"
                                : post.status === "draft"
                                  ? "text-amber-600"
                                  : "text-gray-500"
                            }`}
                          >
                            {STATUS_LABEL[post.status] ?? post.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List view */}
      {view === "list" && (
        <div className="space-y-2">
          {plan.posts.length === 0 ? (
            <div className="text-center py-12 bg-white border border-dashed border-gray-200 rounded-xl">
              <p className="text-gray-400 text-sm">No posts generated yet.</p>
            </div>
          ) : (
            plan.posts
              .slice()
              .sort(
                (a, b) =>
                  new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
              )
              .map((post) => {
                const isEditing = editingPostId === post.id;
                const isEditableStatus = EDITABLE_STATUSES.has(post.status);
                const displayText = post.contentText ?? post.caption ?? "";
                const displayHashtags = post.contentHashtags ?? post.hashtags ?? [];

                return (
                  <div
                    key={post.id}
                    className="p-4 bg-white border border-gray-200 rounded-xl space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="capitalize font-semibold text-gray-700">
                          {post.platform}
                        </span>
                        {!post.socialAccountId && (
                          <span
                            className="text-orange-500 text-xs font-medium"
                            title="Connect this platform in Accounts to enable publishing"
                          >
                            ⚠ no account linked
                          </span>
                        )}
                        <span>·</span>
                        <span>
                          {new Date(post.scheduledAt).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            STATUS_DOT[post.status] ?? "bg-gray-300"
                          }`}
                        />
                        <span className="text-xs text-gray-500">
                          {STATUS_LABEL[post.status] ?? post.status}
                        </span>
                        {canEdit && isEditableStatus && !isEditing && (
                          <button
                            onClick={() => startEdit(post)}
                            className="flex items-center gap-1 px-2 py-0.5 text-xs text-gray-500 border border-gray-200 rounded-md hover:bg-gray-50 hover:text-gray-800 transition-colors"
                            title="Edit post"
                          >
                            <Pencil className="w-3 h-3" /> Edit
                          </button>
                        )}
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="space-y-2 pt-1">
                        <textarea
                          rows={4}
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
                          placeholder="Post content…"
                        />
                        <input
                          type="text"
                          value={editHashtags}
                          onChange={(e) => setEditHashtags(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                          placeholder="Hashtags (comma separated, e.g. marketing, brand)"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveEdit(post.id)}
                            disabled={updatePost.isPending}
                            className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
                          >
                            <Check className="w-3.5 h-3.5" />
                            {updatePost.isPending ? "Saving…" : "Save"}
                          </button>
                          <button
                            onClick={() => setEditingPostId(null)}
                            className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-50"
                          >
                            <X className="w-3.5 h-3.5" />
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {displayText && (
                          <p className="text-sm text-gray-700 line-clamp-3">{displayText}</p>
                        )}
                        {displayHashtags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {displayHashtags.map((tag) => (
                              <span key={tag} className="text-xs text-blue-500">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })
          )}
        </div>
      )}
    </div>
  );
}
