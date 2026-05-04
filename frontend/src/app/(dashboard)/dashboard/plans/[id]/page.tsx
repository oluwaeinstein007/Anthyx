"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Link from "next/link";
import { Pencil, X, Check, Trash2, AlertCircle, ChevronLeft, ChevronRight, Link2, Megaphone } from "lucide-react";

const POSTS_PER_PAGE = 20;

const PLATFORM_CHAR_LIMITS: Record<string, number | null> = {
  x: 280,
  instagram: 2200,
  linkedin: 3000,
  telegram: null,
  facebook: 400,
  tiktok: 2200,
  discord: null,
  whatsapp: 4096,
  slack: null,
  reddit: null,
  threads: 500,
  bluesky: 300,
  mastodon: 500,
  youtube: null,
  pinterest: 500,
  email: null,
};
import { ConfirmDialog } from "@/components/ConfirmDialog";

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
  errorMessage: string | null;
  socialAccountId: string | null;
}

interface MarketingPlan {
  id: string;
  name: string;
  status: string;
  startDate: string;
  endDate: string;
  goals: string[];
  failReason: string | null;
  feedbackLoopEnabled: boolean;
  campaignId: string | null;
  posts: ScheduledPost[];
}

interface Campaign { id: string; name: string; }

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

const EDITABLE_STATUSES = new Set(["draft", "pending_review", "approved", "scheduled"]);

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

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const date = new Date(year, month, 1);
  while (date.getMonth() === month) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
}

const PLATFORM_COLORS: Record<string, string> = {
  x: "bg-gray-900",
  instagram: "bg-pink-500",
  linkedin: "bg-blue-600",
  facebook: "bg-blue-800",
  tiktok: "bg-black",
  threads: "bg-gray-700",
  pinterest: "bg-red-600",
  email: "bg-green-600",
  discord: "bg-indigo-600",
  slack: "bg-yellow-500",
  youtube: "bg-red-500",
};

const POST_STATUS_BADGE: Record<string, string> = {
  pending_review: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  scheduled: "bg-green-100 text-green-700",
  published: "bg-blue-100 text-blue-700",
  vetoed: "bg-red-100 text-red-700",
  failed: "bg-red-100 text-red-700",
  draft: "bg-gray-100 text-gray-600",
  silenced: "bg-red-100 text-red-600",
};

export default function PlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [view, setView] = useState<ViewMode>("calendar");
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editGoals, setEditGoals] = useState("");
  const [editFeedback, setEditFeedback] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Campaign assignment state
  const [assigningCampaign, setAssigningCampaign] = useState(false);
  const [campaignDraft, setCampaignDraft] = useState<string>("");

  // Per-post edit state
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editHashtags, setEditHashtags] = useState("");
  const [editScheduledAt, setEditScheduledAt] = useState("");
  const [postSaveError, setPostSaveError] = useState<string | null>(null);
  const [uploadingPostId, setUploadingPostId] = useState<string | null>(null);

  // List view state
  const [listPage, setListPage] = useState(0);
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);

  // Month-grid calendar state (initialised after plan loads — updated below when plan is available)
  const [calMonth, setCalMonth] = useState<{ year: number; month: number } | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const { data: plan, isLoading, isError, error } = useQuery<MarketingPlan>({
    queryKey: ["plan", id],
    queryFn: () => api.get<MarketingPlan>(`/plans/${id}`),
    refetchInterval: 15_000,
    retry: 1,
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
    mutationFn: (body: { name?: string; goals?: string[]; feedbackLoopEnabled?: boolean; campaignId?: string | null }) =>
      api.put(`/plans/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plan", id] });
      qc.invalidateQueries({ queryKey: ["plans"] });
      setEditing(false);
      setAssigningCampaign(false);
    },
  });

  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ["campaigns"],
    queryFn: () => api.get<Campaign[]>("/campaigns"),
  });

  const deletePlan = useMutation({
    mutationFn: () => api.delete(`/plans/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plans"] });
      router.push("/dashboard/plans");
    },
  });

  const updatePost = useMutation({
    mutationFn: ({ postId, body }: { postId: string; body: Record<string, unknown> }) =>
      api.put(`/posts/${postId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plan", id] });
      setEditingPostId(null);
      setPostSaveError(null);
    },
    onError: (err) => {
      setPostSaveError(err instanceof Error ? err.message : "Failed to save post.");
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

  function startEditPost(post: ScheduledPost) {
    setEditingPostId(post.id);
    setEditText(post.contentText ?? post.caption ?? "");
    setEditHashtags((post.contentHashtags ?? post.hashtags ?? []).join(", "));
    // datetime-local expects "YYYY-MM-DDTHH:mm" in local time
    const d = new Date(post.scheduledAt);
    const pad = (n: number) => String(n).padStart(2, "0");
    setEditScheduledAt(
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    );
  }

  async function uploadPostMedia(postId: string, file: File) {
    setUploadingPostId(postId);
    setPostSaveError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      await api.upload(`/posts/${postId}/upload-media`, form);
      qc.invalidateQueries({ queryKey: ["plan", id] });
    } catch (err) {
      setPostSaveError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploadingPostId(null);
    }
  }

  function saveEditPost(postId: string) {
    const hashtags = editHashtags
      .split(",")
      .map((h) => h.trim().replace(/^#/, ""))
      .filter(Boolean);
    updatePost.mutate({
      postId,
      body: {
        contentText: editText,
        ...(hashtags.length > 0 && { contentHashtags: hashtags }),
        ...(editScheduledAt && { scheduledAt: new Date(editScheduledAt).toISOString() }),
      },
    });
  }

  if (isLoading)
    return <div className="text-sm text-gray-500 animate-pulse">Loading plan...</div>;
  if (isError)
    return (
      <div className="space-y-2">
        <Link href="/dashboard/plans" className="text-sm text-gray-400 hover:text-gray-600">← Plans</Link>
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error instanceof Error ? error.message : "Failed to load plan."}
        </div>
      </div>
    );
  if (!plan)
    return (
      <div className="space-y-2">
        <Link href="/dashboard/plans" className="text-sm text-gray-400 hover:text-gray-600">← Plans</Link>
        <p className="text-sm text-gray-500">Plan not found.</p>
      </div>
    );

  const days = getDaysInRange(plan.startDate, plan.endDate);
  const postsByDay: Record<string, ScheduledPost[]> = {};
  for (const post of plan.posts) {
    const dayKey = new Date(post.scheduledAt).toISOString().split("T")[0]!;
    if (!postsByDay[dayKey]) postsByDay[dayKey] = [];
    postsByDay[dayKey].push(post);
  }

  // Derive active calendar month — default to plan's start month on first render
  const startD = new Date(plan.startDate);
  const activeCalMonth = calMonth ?? { year: startD.getFullYear(), month: startD.getMonth() };

  function prevCalMonth() {
    const m = activeCalMonth.month === 0 ? 11 : activeCalMonth.month - 1;
    const y = activeCalMonth.month === 0 ? activeCalMonth.year - 1 : activeCalMonth.year;
    setCalMonth({ year: y, month: m });
    setSelectedDay(null);
  }
  function nextCalMonth() {
    const m = activeCalMonth.month === 11 ? 0 : activeCalMonth.month + 1;
    const y = activeCalMonth.month === 11 ? activeCalMonth.year + 1 : activeCalMonth.year;
    setCalMonth({ year: y, month: m });
    setSelectedDay(null);
  }

  const calDays = getDaysInMonth(activeCalMonth.year, activeCalMonth.month);
  // Offset: 0=Sun,1=Mon,...,6=Sat
  const firstDayOffset = calDays[0]!.getDay();
  const monthLabel = new Date(activeCalMonth.year, activeCalMonth.month, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const selectedDayPosts = selectedDay ? (postsByDay[selectedDay] ?? []) : [];

  const canEdit = !["generating", "completed"].includes(plan.status);

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

              {/* Campaign assignment */}
              <div className="mt-3">
                {assigningCampaign ? (
                  <div className="flex items-center gap-2">
                    <Megaphone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <select
                      autoFocus
                      value={campaignDraft}
                      onChange={(e) => setCampaignDraft(e.target.value)}
                      className="px-2.5 py-1 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                    >
                      <option value="">No campaign</option>
                      {campaigns.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => updatePlan.mutate({ campaignId: campaignDraft || null })}
                      disabled={updatePlan.isPending}
                      className="p-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setAssigningCampaign(false)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setCampaignDraft(plan.campaignId ?? "");
                      setAssigningCampaign(true);
                    }}
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-green-600 transition-colors group"
                  >
                    <Megaphone className="w-3.5 h-3.5" />
                    {plan.campaignId
                      ? <span className="group-hover:underline">
                          {campaigns.find((c) => c.id === plan.campaignId)?.name ?? "Campaign"}
                        </span>
                      : <span className="group-hover:underline">Assign to campaign</span>
                    }
                    <Link2 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                )}
              </div>
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
            {retry.isError && (
              <span className="text-xs text-red-500">
                {retry.error instanceof Error ? retry.error.message : "Retry failed"}
              </span>
            )}
            {plan.status === "generating" && (
              <span className="text-xs text-blue-600 animate-pulse">Generating…</span>
            )}
            <button
              onClick={() => setConfirmDelete(true)}
              disabled={deletePlan.isPending}
              className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded"
              title="Delete plan"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Failure reason banner */}
      {plan.status === "failed" && plan.failReason && (
        <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Generation failed</p>
            <p className="text-xs text-red-600 mt-0.5">{plan.failReason}</p>
          </div>
        </div>
      )}

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

      {/* Calendar view — month grid */}
      {view === "calendar" && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          {/* Month navigation header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <button
              onClick={prevCalMonth}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold text-gray-800">{monthLabel}</span>
            <button
              onClick={nextCalMonth}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Day-of-week header */}
          <div className="grid grid-cols-7 border-b border-gray-100">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-2 text-center text-xs font-medium text-gray-400">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {/* Leading empty cells for offset */}
            {Array.from({ length: firstDayOffset }, (_, i) => (
              <div key={`empty-${i}`} className="min-h-[80px] border-b border-r border-gray-50 bg-gray-50/50" />
            ))}

            {calDays.map((day) => {
              const key = day.toISOString().split("T")[0]!;
              const dayPosts = postsByDay[key] ?? [];
              const isToday = key === new Date().toISOString().split("T")[0];
              const isSelected = key === selectedDay;
              const isInPlan = !!postsByDay[key] || days.some((d) => d.toISOString().split("T")[0] === key);

              return (
                <button
                  key={key}
                  onClick={() => setSelectedDay(isSelected ? null : key)}
                  className={`min-h-[80px] p-2 border-b border-r border-gray-100 text-left transition-colors ${
                    isSelected
                      ? "bg-gray-900 text-white"
                      : isToday
                        ? "bg-green-50"
                        : "hover:bg-gray-50"
                  } ${!isInPlan ? "opacity-40" : ""}`}
                >
                  <span
                    className={`text-xs font-semibold block mb-1.5 ${
                      isSelected ? "text-white" : isToday ? "text-green-700" : "text-gray-600"
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  {/* Platform colored dots */}
                  <div className="flex flex-wrap gap-1">
                    {dayPosts.slice(0, 6).map((post) => (
                      <span
                        key={post.id}
                        title={`${post.platform} · ${STATUS_LABEL[post.status] ?? post.status}`}
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          PLATFORM_COLORS[post.platform] ?? "bg-gray-400"
                        }`}
                      />
                    ))}
                    {dayPosts.length > 6 && (
                      <span className={`text-xs leading-none ${isSelected ? "text-gray-300" : "text-gray-400"}`}>
                        +{dayPosts.length - 6}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected day detail panel */}
          {selectedDay && (
            <div className="border-t border-gray-200 px-5 py-4">
              <p className="text-xs font-semibold text-gray-500 mb-3">
                {new Date(selectedDay + "T12:00:00").toLocaleDateString("en-US", {
                  weekday: "long", month: "long", day: "numeric",
                })}
                {" "}
                <span className="font-normal text-gray-400">
                  {selectedDayPosts.length === 0
                    ? "— no posts"
                    : `— ${selectedDayPosts.length} post${selectedDayPosts.length !== 1 ? "s" : ""}`}
                </span>
              </p>
              {selectedDayPosts.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No posts scheduled for this day.</p>
              ) : (
                <div className="space-y-2">
                  {selectedDayPosts.map((post) => {
                    const text = post.contentText ?? post.caption ?? "";
                    return (
                      <div
                        key={post.id}
                        className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50"
                      >
                        <span
                          className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1 ${
                            PLATFORM_COLORS[post.platform] ?? "bg-gray-400"
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="capitalize text-xs font-semibold text-gray-700">{post.platform}</span>
                            <span className="text-xs text-gray-400">
                              {new Date(post.scheduledAt).toLocaleTimeString("en-US", {
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                POST_STATUS_BADGE[post.status] ?? "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {STATUS_LABEL[post.status] ?? post.status}
                            </span>
                          </div>
                          {text && (
                            <p className="text-xs text-gray-600 line-clamp-2">
                              {text.slice(0, 50)}{text.length > 50 ? "…" : ""}
                            </p>
                          )}
                          {post.status === "failed" && post.errorMessage && (
                            <p className="text-xs text-red-500 mt-0.5">{post.errorMessage}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* List view */}
      {view === "list" && (() => {
        const sortedPosts = plan.posts
          .slice()
          .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
        const totalPages = Math.ceil(sortedPosts.length / POSTS_PER_PAGE);
        const pagePosts = sortedPosts.slice(listPage * POSTS_PER_PAGE, (listPage + 1) * POSTS_PER_PAGE);

        return (
          <div className="space-y-2">
            {plan.posts.length === 0 ? (
              <div className="text-center py-12 bg-white border border-dashed border-gray-200 rounded-xl">
                <p className="text-gray-400 text-sm">No posts generated yet.</p>
              </div>
            ) : (
              <>
                {pagePosts.map((post) => {
                  const isEditing = editingPostId === post.id;
                  const isEditableStatus = EDITABLE_STATUSES.has(post.status);
                  const displayText = post.contentText ?? post.caption ?? "";
                  const displayHashtags = post.contentHashtags ?? post.hashtags ?? [];
                  const isExpanded = expandedPostId === post.id;
                  const charLimit = PLATFORM_CHAR_LIMITS[post.platform] ?? null;
                  const charCount = editText.length;
                  const isOverLimit = isEditing && charLimit !== null && charCount > charLimit;

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
                              onClick={() => { startEditPost(post); setPostSaveError(null); }}
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
                          <div className="relative">
                            <textarea
                              rows={5}
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              className={`w-full px-3 py-2 border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 ${
                                isOverLimit
                                  ? "border-red-400 focus:ring-red-400"
                                  : "border-gray-300 focus:ring-green-500"
                              }`}
                              placeholder="Post content…"
                            />
                            <span
                              className={`absolute bottom-2 right-2 text-xs ${
                                isOverLimit ? "text-red-500 font-medium" : "text-gray-400"
                              }`}
                            >
                              {charLimit !== null
                                ? `${charCount} / ${charLimit}`
                                : charCount}
                            </span>
                          </div>
                          <input
                            type="text"
                            value={editHashtags}
                            onChange={(e) => setEditHashtags(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                            placeholder="Hashtags (comma separated, e.g. marketing, brand)"
                          />
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Scheduled time</label>
                            <input
                              type="datetime-local"
                              value={editScheduledAt}
                              onChange={(e) => setEditScheduledAt(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Media (image / video)</label>
                            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors">
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime"
                                className="hidden"
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPostMedia(post.id, f); e.target.value = ""; }}
                              />
                              {uploadingPostId === post.id ? "Uploading…" : "Upload image / video"}
                            </label>
                          </div>
                          {postSaveError && (
                            <p className="text-xs text-red-600 flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {postSaveError}
                            </p>
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveEditPost(post.id)}
                              disabled={updatePost.isPending || isOverLimit}
                              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
                            >
                              <Check className="w-3.5 h-3.5" />
                              {updatePost.isPending ? "Saving…" : "Save"}
                            </button>
                            <button
                              onClick={() => { setEditingPostId(null); setPostSaveError(null); }}
                              className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-50"
                            >
                              <X className="w-3.5 h-3.5" />
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {post.status === "failed" ? (
                            post.errorMessage && (
                              <p className="text-sm text-red-500">{post.errorMessage}</p>
                            )
                          ) : (
                            displayText && (
                              <div>
                                <p
                                  className={`text-sm text-gray-700 whitespace-pre-wrap ${
                                    isExpanded ? "" : "line-clamp-3"
                                  }`}
                                >
                                  {displayText}
                                </p>
                                {displayText.length > 200 && (
                                  <button
                                    onClick={() =>
                                      setExpandedPostId(isExpanded ? null : post.id)
                                    }
                                    className="text-xs text-gray-400 hover:text-gray-600 mt-1 transition-colors"
                                  >
                                    {isExpanded ? "Show less ↑" : "Show more ↓"}
                                  </button>
                                )}
                              </div>
                            )
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
                })}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-gray-400">
                      {listPage * POSTS_PER_PAGE + 1}–{Math.min((listPage + 1) * POSTS_PER_PAGE, sortedPosts.length)} of {sortedPosts.length} posts
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setListPage((p) => Math.max(0, p - 1))}
                        disabled={listPage === 0}
                        className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => (
                        <button
                          key={i}
                          onClick={() => setListPage(i)}
                          className={`w-7 h-7 text-xs rounded-lg font-medium transition-colors ${
                            listPage === i
                              ? "bg-gray-900 text-white"
                              : "border border-gray-200 text-gray-500 hover:bg-gray-50"
                          }`}
                        >
                          {i + 1}
                        </button>
                      ))}
                      <button
                        onClick={() => setListPage((p) => Math.min(totalPages - 1, p + 1))}
                        disabled={listPage === totalPages - 1}
                        className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })()}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete plan"
          description="This will permanently delete the plan and all its scheduled posts. This cannot be undone."
          confirmLabel="Delete plan"
          isPending={deletePlan.isPending}
          onConfirm={() => deletePlan.mutate()}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
