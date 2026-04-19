"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Link from "next/link";
import { Pencil, X, Check, Trash2 } from "lucide-react";

interface ScheduledPost {
  id: string;
  platform: string;
  scheduledAt: string;
  status: string;
  contentText: string | null;
  contentHashtags: string[] | null;
  mediaUrls: string[] | null;
  errorMessage: string | null;
}

interface MarketingPlan {
  id: string;
  name: string;
  status: string;
  startDate: string;
  endDate: string;
  goals: string[];
  feedbackLoopEnabled: boolean;
  posts: ScheduledPost[];
}

const STATUS_DOT: Record<string, string> = {
  draft: "bg-gray-300",
  pending_review: "bg-amber-400",
  approved: "bg-blue-400",
  scheduled: "bg-blue-500",
  published: "bg-green-500",
  failed: "bg-red-500",
  silenced: "bg-red-300",
  vetoed: "bg-red-400",
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
  paused: "bg-orange-100 text-orange-700",
  failed: "bg-red-100 text-red-700",
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

export default function PlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [view, setView] = useState<ViewMode>("calendar");
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editGoals, setEditGoals] = useState("");
  const [editFeedback, setEditFeedback] = useState(false);

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

  const retry = useMutation({
    mutationFn: () => api.post(`/plans/${id}/retry`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plan", id] }),
  });

  const retryFailed = useMutation({
    mutationFn: () => api.post(`/plans/${id}/retry-failed`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plan", id] }),
  });

  const generateContent = useMutation({
    mutationFn: () => api.post(`/plans/${id}/generate-content`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plan", id] }),
  });

  const updatePlan = useMutation({
    mutationFn: (body: { name?: string; goals?: string[]; feedbackLoopEnabled?: boolean }) =>
      api.put(`/plans/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plan", id] });
      setEditing(false);
    },
  });

  const deletePlan = useMutation({
    mutationFn: () => api.delete(`/plans/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plans"] });
      router.push("/dashboard/plans");
    },
  });

  const startEdit = () => {
    if (!plan) return;
    setEditName(plan.name);
    setEditGoals(plan.goals.join("\n"));
    setEditFeedback(plan.feedbackLoopEnabled);
    setEditing(true);
  };

  const saveEdit = () => {
    updatePlan.mutate({
      name: editName.trim() || undefined,
      goals: editGoals.split("\n").map((g) => g.trim()).filter(Boolean),
      feedbackLoopEnabled: editFeedback,
    });
  };

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
  const pendingCount = plan.posts.filter((p) => p.status === "pending_review").length;
  const failedCount = plan.posts.filter((p) => p.status === "failed").length;
  const draftCount = plan.posts.filter((p) => p.status === "draft").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/dashboard/plans"
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              ← Plans
            </Link>
          </div>

          {editing ? (
            <div className="space-y-3">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full text-2xl font-bold text-gray-900 border-b border-gray-300 focus:outline-none focus:border-green-500 bg-transparent pb-1"
              />
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">
                  Goals <span className="text-gray-400 font-normal">(one per line)</span>
                </label>
                <textarea
                  rows={3}
                  value={editGoals}
                  onChange={(e) => setEditGoals(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={editFeedback}
                  onChange={(e) => setEditFeedback(e.target.checked)}
                  className="rounded accent-green-600"
                />
                Enable feedback loop
              </label>
              <div className="flex gap-2">
                <button
                  onClick={saveEdit}
                  disabled={updatePlan.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  {updatePlan.isPending ? "Saving..." : "Save changes"}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900">{plan.name}</h1>
                <button
                  onClick={startEdit}
                  className="p-1 text-gray-400 hover:text-gray-600 transition-colors rounded"
                  title="Edit plan"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
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
            </>
          )}
        </div>

        {!editing && (
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                PLAN_STATUS_STYLES[plan.status] ?? "bg-gray-100 text-gray-600"
              }`}
            >
              {plan.status.replace(/_/g, " ")}
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
                className="px-3 py-1.5 border border-orange-200 text-orange-600 text-xs font-medium rounded-lg hover:bg-orange-50 disabled:opacity-50 transition-colors"
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
            {plan.status === "failed" && (
              <button
                onClick={() => retry.mutate()}
                disabled={retry.isPending}
                className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {retry.isPending ? "Retrying..." : "Retry generation"}
              </button>
            )}
            {plan.status === "generating" && (
              <span className="text-xs text-blue-600 animate-pulse">Generating…</span>
            )}
            <button
              onClick={() => {
                if (confirm("Delete this plan and all its posts? This cannot be undone.")) {
                  deletePlan.mutate();
                }
              }}
              disabled={deletePlan.isPending}
              className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded"
              title="Delete plan"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
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
          <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Pending review</p>
        </div>
        <div className={`p-4 bg-white rounded-xl text-center ${failedCount > 0 ? "border border-red-100" : "border border-gray-200"}`}>
          <p className={`text-2xl font-bold ${failedCount > 0 ? "text-red-500" : "text-gray-300"}`}>{failedCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Failed</p>
        </div>
        <div className={`p-4 bg-white rounded-xl text-center ${draftCount > 0 ? "border border-gray-300" : "border border-gray-200"}`}>
          <p className={`text-2xl font-bold ${draftCount > 0 ? "text-gray-500" : "text-gray-300"}`}>{draftCount}</p>
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
        <div className="ml-auto flex items-center gap-3">
          {draftCount > 0 && ["active", "pending_review"].includes(plan.status) && (
            <button
              onClick={() => generateContent.mutate()}
              disabled={generateContent.isPending}
              className="text-xs text-gray-500 hover:text-gray-700 hover:underline disabled:opacity-50"
            >
              {generateContent.isPending ? "Generating…" : `Generate content for ${draftCount} draft${draftCount !== 1 ? "s" : ""} →`}
            </button>
          )}
          {pendingCount > 0 && plan.status === "active" && (
            <Link
              href="/dashboard/review"
              className="text-xs text-amber-600 hover:underline"
            >
              {pendingCount} post{pendingCount !== 1 ? "s" : ""} need review →
            </Link>
          )}
          {failedCount > 0 && ["active", "pending_review"].includes(plan.status) && (
            <button
              onClick={() => retryFailed.mutate()}
              disabled={retryFailed.isPending}
              className="text-xs text-red-500 hover:underline disabled:opacity-50"
            >
              {retryFailed.isPending ? "Retrying…" : `Retry ${failedCount} failed post${failedCount !== 1 ? "s" : ""} →`}
            </button>
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
                          className={`flex flex-col bg-white border rounded-lg px-2.5 py-1.5 text-xs shadow-sm ${
                            post.status === "failed" ? "border-red-200" : "border-gray-200"
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                STATUS_DOT[post.status] ?? "bg-gray-300"
                              }`}
                            />
                            <span className="capitalize font-medium text-gray-700">
                              {post.platform}
                            </span>
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
                                  : post.status === "failed"
                                    ? "text-red-500"
                                    : "text-gray-500"
                              }`}
                            >
                              {STATUS_LABEL[post.status] ?? post.status}
                            </span>
                          </div>
                          {post.status === "failed" && post.errorMessage && (
                            <p className="mt-0.5 text-red-400 leading-tight pl-3">
                              {post.errorMessage}
                            </p>
                          )}
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
              .map((post) => (
                <div
                  key={post.id}
                  className="p-4 bg-white border border-gray-200 rounded-xl space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="capitalize font-semibold text-gray-700">
                        {post.platform}
                      </span>
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
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          STATUS_DOT[post.status] ?? "bg-gray-300"
                        }`}
                      />
                      <span className="text-xs text-gray-500">
                        {STATUS_LABEL[post.status] ?? post.status}
                      </span>
                    </div>
                  </div>
                  {post.status === "failed" ? (
                    post.errorMessage && (
                      <p className="text-sm text-red-500">{post.errorMessage}</p>
                    )
                  ) : (
                    post.contentText && (
                      <p className="text-sm text-gray-700 line-clamp-2">{post.contentText}</p>
                    )
                  )}
                  {post.contentHashtags && post.contentHashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {post.contentHashtags.map((tag) => (
                        <span key={tag} className="text-xs text-blue-500">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
          )}
        </div>
      )}
    </div>
  );
}
