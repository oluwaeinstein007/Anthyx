"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Link from "next/link";
import {
  ArrowLeft, BarChart3, CheckCircle2, XCircle, AlertCircle, Plus,
  FileText, Sparkles, X, Link2, ChevronDown, ChevronUp, DollarSign,
} from "lucide-react";

interface CampaignPlan {
  id: string;
  name: string;
  status: string;
  budgetAllocatedCents: number | null;
}

interface CampaignAnalytics {
  campaign: { id: string; name: string; goals: string[]; budgetCapCents: number | null };
  plans: CampaignPlan[];
  totals: {
    posts: number;
    published: number;
    failed: number;
    vetoed: number;
    totalLikes: number;
    totalReposts: number;
    totalComments: number;
    totalImpressions: number;
    avgEngagementRate: number;
  };
  byPlatform: Record<string, { published: number; likes: number; impressions: number; engagementRate: number }>;
}

interface UnlinkedPlan { id: string; name: string; status: string; campaignId: string | null; brandProfileId: string; }
interface Brand { id: string; name: string; }
interface Agent { id: string; name: string; brandProfileId: string; }

const SUGGESTED_GOALS = [
  "Increase brand awareness", "Drive website traffic", "Grow followers",
  "Build community engagement", "Generate leads", "Showcase products",
  "Establish thought leadership", "Promote content",
];

const PLATFORMS = [
  "x", "instagram", "linkedin", "facebook", "telegram", "tiktok",
  "threads", "bluesky", "reddit", "youtube", "pinterest",
  "mastodon", "discord", "whatsapp", "slack",
];

function fmt(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5">
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function BudgetBar({ allocatedCents, capCents }: { allocatedCents: number; capCents: number }) {
  const pct = Math.min(100, (allocatedCents / capCents) * 100);
  const over = allocatedCents > capCents;
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 col-span-2 md:col-span-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <DollarSign className="w-4 h-4 text-green-600" />
          <p className="text-xs font-medium text-gray-700">Budget allocation</p>
        </div>
        <span className={`text-xs font-semibold ${over ? "text-red-600" : "text-gray-700"}`}>
          {fmt(allocatedCents)} / {fmt(capCents)}
        </span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${over ? "bg-red-500" : pct > 85 ? "bg-amber-500" : "bg-green-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <p className="text-xs text-gray-400">
          {over
            ? `${fmt(allocatedCents - capCents)} over budget`
            : `${fmt(capCents - allocatedCents)} remaining`}
        </p>
        <p className="text-xs text-gray-400">{pct.toFixed(0)}% allocated</p>
      </div>
      {over && (
        <p className="mt-2 text-xs text-red-600 font-medium">
          Total allocated across plans exceeds the campaign budget cap.
        </p>
      )}
    </div>
  );
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const [panel, setPanel] = useState<"none" | "generate" | "link">("none");

  const [form, setForm] = useState({
    brandProfileId: "", agentId: "", platforms: [] as string[], goals: [] as string[],
    startDate: new Date().toISOString().split("T")[0] ?? "",
    durationDays: 30, feedbackLoopEnabled: false, postsPerPlatformPerDay: 1,
    budgetAllocated: "",
  });
  const [goalInput, setGoalInput] = useState("");
  const goalInputRef = useRef<HTMLInputElement>(null);
  const [generateError, setGenerateError] = useState("");
  const [generateSuccess, setGenerateSuccess] = useState(false);

  // Per-plan inline budget editing state: planId -> draft string value
  const [planBudgetDrafts, setPlanBudgetDrafts] = useState<Record<string, string>>({});
  const [editingBudgetPlan, setEditingBudgetPlan] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<CampaignAnalytics>({
    queryKey: ["campaign-analytics", id],
    queryFn: () => api.get<CampaignAnalytics>(`/campaigns/${id}/analytics`),
  });

  const { data: allPlans = [] } = useQuery<UnlinkedPlan[]>({
    queryKey: ["plans"],
    queryFn: () => api.get<UnlinkedPlan[]>("/plans"),
  });

  const { data: brands = [] } = useQuery<Brand[]>({
    queryKey: ["brands"],
    queryFn: () => api.get<Brand[]>("/brands"),
  });

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["agents"],
    queryFn: () => api.get<Agent[]>("/agents"),
  });

  const filteredAgents = agents.filter((a) => !form.brandProfileId || a.brandProfileId === form.brandProfileId);
  const canGenerate = form.brandProfileId && form.agentId && form.platforms.length > 0 && form.goals.length > 0;

  const linkedPlanIds = new Set((data?.plans ?? []).map((p) => p.id));
  const unlinkedPlans = allPlans.filter((p) => !p.campaignId && !linkedPlanIds.has(p.id));

  // Total allocated across plans in this campaign
  const totalAllocatedCents = (data?.plans ?? []).reduce((sum, p) => sum + (p.budgetAllocatedCents ?? 0), 0);
  const capCents = data?.campaign.budgetCapCents ?? null;
  const overBudget = capCents != null && totalAllocatedCents > capCents;

  const generate = useMutation({
    mutationFn: () =>
      api.post("/plans/generate", {
        brandProfileId: form.brandProfileId,
        agentId: form.agentId,
        platforms: form.platforms,
        goals: form.goals,
        startDate: new Date(form.startDate).toISOString(),
        durationDays: form.durationDays,
        feedbackLoopEnabled: form.feedbackLoopEnabled,
        postsPerPlatformPerDay: form.postsPerPlatformPerDay,
        campaignId: id,
        ...(form.budgetAllocated
          ? { budgetAllocatedCents: Math.round(parseFloat(form.budgetAllocated) * 100) }
          : {}),
      }),
    onSuccess: () => {
      setPanel("none");
      setGenerateError("");
      setGenerateSuccess(true);
      setForm({
        brandProfileId: "", agentId: "", platforms: [], goals: [],
        startDate: new Date().toISOString().split("T")[0] ?? "",
        durationDays: 30, feedbackLoopEnabled: false, postsPerPlatformPerDay: 1,
        budgetAllocated: "",
      });
      qc.invalidateQueries({ queryKey: ["campaign-analytics", id] });
      qc.invalidateQueries({ queryKey: ["plans"] });
      setTimeout(() => setGenerateSuccess(false), 6000);
    },
    onError: (err) => setGenerateError(err instanceof Error ? err.message : "Failed to generate plan."),
  });

  const linkPlan = useMutation({
    mutationFn: (planId: string) => api.put(`/plans/${planId}`, { campaignId: id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaign-analytics", id] });
      qc.invalidateQueries({ queryKey: ["plans"] });
    },
  });

  const updatePlanBudget = useMutation({
    mutationFn: ({ planId, cents }: { planId: string; cents: number | null }) =>
      api.put(`/plans/${planId}`, { budgetAllocatedCents: cents }),
    onSuccess: () => {
      setEditingBudgetPlan(null);
      qc.invalidateQueries({ queryKey: ["campaign-analytics", id] });
    },
  });

  const addGoal = (g: string) => {
    const t = g.trim();
    if (t && !form.goals.includes(t)) setForm((f) => ({ ...f, goals: [...f.goals, t] }));
    setGoalInput("");
  };
  const removeGoal = (g: string) => setForm((f) => ({ ...f, goals: f.goals.filter((x) => x !== g) }));
  const handleGoalKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addGoal(goalInput); }
    else if (e.key === "Backspace" && !goalInput && form.goals.length > 0) removeGoal(form.goals[form.goals.length - 1]!);
  };
  const togglePlatform = (p: string) =>
    setForm((f) => ({ ...f, platforms: f.platforms.includes(p) ? f.platforms.filter((x) => x !== p) : [...f.platforms, p] }));

  function savePlanBudget(planId: string) {
    const raw = planBudgetDrafts[planId] ?? "";
    const cents = raw.trim() === "" ? null : Math.round(parseFloat(raw) * 100);
    if (raw.trim() !== "" && (isNaN(cents!) || cents! < 0)) return;
    updatePlanBudget.mutate({ planId, cents });
  }

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-gray-100 rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="text-center py-24">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="text-gray-600">Failed to load campaign analytics.</p>
        <Link href="/dashboard/campaigns" className="mt-4 inline-flex items-center gap-1 text-sm text-green-600 hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to campaigns
        </Link>
      </div>
    );
  }

  const { campaign, plans, totals, byPlatform } = data;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/campaigns" className="p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{campaign.name}</h1>
          {campaign.goals.length > 0 && (
            <p className="text-sm text-gray-400 mt-0.5">{campaign.goals.join(" · ")}</p>
          )}
        </div>
      </div>

      {generateSuccess && (
        <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-2xl">
          <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-green-800">Plan generation started</p>
            <p className="text-xs text-green-600 mt-0.5">Your content calendar is being generated and will appear below once ready.</p>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Posts Published" value={totals.published} />
        <StatCard label="Total Impressions" value={totals.totalImpressions.toLocaleString()} />
        <StatCard label="Total Likes" value={totals.totalLikes.toLocaleString()} />
        <StatCard label="Avg Engagement Rate" value={`${(totals.avgEngagementRate * 100).toFixed(2)}%`} />
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <p className="text-xs font-medium text-gray-500 mb-1">Outcome</p>
          <div className="flex items-center gap-4 mt-1">
            <span className="flex items-center gap-1 text-sm text-green-600 font-medium">
              <CheckCircle2 className="w-4 h-4" /> {totals.published}
            </span>
            <span className="flex items-center gap-1 text-sm text-red-500 font-medium">
              <XCircle className="w-4 h-4" /> {totals.vetoed} vetoed
            </span>
          </div>
        </div>
        {capCents && (
          <StatCard
            label="Budget cap"
            value={fmt(capCents)}
            sub="Max allocated for this campaign"
          />
        )}

        {/* Budget allocation bar — only shown when a cap is set and at least one plan has an allocation */}
        {capCents != null && totalAllocatedCents > 0 && (
          <BudgetBar allocatedCents={totalAllocatedCents} capCents={capCents} />
        )}
        {capCents != null && totalAllocatedCents === 0 && plans.length > 0 && (
          <div className="col-span-2 md:col-span-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl">
            <p className="text-xs text-amber-700">
              Budget cap is set to {fmt(capCents)} but no plans have a budget allocated yet. Edit each plan below to assign a portion of the budget.
            </p>
          </div>
        )}
      </div>

      {/* By platform */}
      {Object.keys(byPlatform).length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-green-600" /> Performance by platform
          </h2>
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100">
            {Object.entries(byPlatform).map(([platform, stats]) => (
              <div key={platform} className="px-5 py-4 flex items-center justify-between">
                <span className="capitalize text-sm font-medium text-gray-800">{platform}</span>
                <div className="flex items-center gap-6 text-sm text-gray-500">
                  <span>{stats.published} posts</span>
                  <span>{stats.impressions.toLocaleString()} imp.</span>
                  <span>{stats.likes.toLocaleString()} likes</span>
                  <span className="font-medium text-gray-800">{(stats.engagementRate * 100).toFixed(2)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plans section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-green-600" /> Plans in this campaign
          </h2>
          <div className="flex items-center gap-2">
            {unlinkedPlans.length > 0 && (
              <button
                onClick={() => setPanel(panel === "link" ? "none" : "link")}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl text-xs font-medium transition-colors"
              >
                <Link2 className="w-3.5 h-3.5" />
                Attach existing
                {panel === "link" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
            <button
              onClick={() => { setPanel(panel === "generate" ? "none" : "generate"); setGenerateError(""); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-semibold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              {panel === "generate" ? "Cancel" : "New plan"}
            </button>
          </div>
        </div>

        {/* Attach existing plan panel */}
        {panel === "link" && (
          <div className="mb-4 bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
              <Link2 className="w-4 h-4 text-green-600" />
              <h3 className="text-sm font-semibold text-gray-800">Attach an existing plan</h3>
            </div>
            <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
              {unlinkedPlans.map((plan) => {
                const wouldExceed = capCents != null &&
                  (totalAllocatedCents) > capCents;
                return (
                  <div key={plan.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{plan.name}</p>
                      <p className="text-xs text-gray-400 capitalize">{plan.status.replace("_", " ")}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {wouldExceed && (
                        <span className="text-xs text-amber-600 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> over budget
                        </span>
                      )}
                      <button
                        onClick={() => linkPlan.mutate(plan.id)}
                        disabled={linkPlan.isPending}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-xs font-medium rounded-xl transition-colors"
                      >
                        Attach
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Inline generate form */}
        {panel === "generate" && (
          <div className="mb-4 bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2.5">
              <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Generate new plan</h3>
                <p className="text-xs text-gray-400">Will be linked to <strong>{campaign.name}</strong></p>
              </div>
            </div>
            <div className="p-6 space-y-5">
              {generateError && (
                <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{generateError}</p>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Brand</label>
                  <select
                    value={form.brandProfileId}
                    onChange={(e) => setForm((f) => ({ ...f, brandProfileId: e.target.value, agentId: "" }))}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                  >
                    <option value="">Select brand…</option>
                    {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Agent</label>
                  <select
                    value={form.agentId}
                    onChange={(e) => setForm((f) => ({ ...f, agentId: e.target.value }))}
                    disabled={!form.brandProfileId}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white disabled:opacity-50"
                  >
                    <option value="">Select agent…</option>
                    {filteredAgents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Platforms</label>
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => togglePlatform(p)}
                      className={`px-3.5 py-1.5 text-xs rounded-xl border font-medium transition-colors capitalize ${
                        form.platforms.includes(p)
                          ? "bg-green-600 text-white border-green-600"
                          : "border-gray-200 text-gray-600 hover:border-green-300 hover:text-green-700"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Goals</label>
                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  {SUGGESTED_GOALS.map((g) => {
                    const active = form.goals.includes(g);
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => active ? removeGoal(g) : addGoal(g)}
                        className={`px-3 py-1 text-xs rounded-full border font-medium transition-colors ${
                          active ? "bg-green-600 text-white border-green-600" : "border-gray-200 text-gray-500 hover:border-green-300 hover:text-green-700"
                        }`}
                      >
                        {active && <span className="mr-1">✓</span>}{g}
                      </button>
                    );
                  })}
                </div>
                <div
                  className="flex flex-wrap gap-1.5 min-h-[42px] px-3 py-2 border border-gray-300 rounded-xl focus-within:ring-2 focus-within:ring-green-500 cursor-text"
                  onClick={() => goalInputRef.current?.focus()}
                >
                  {form.goals.filter((g) => !SUGGESTED_GOALS.includes(g)).map((g) => (
                    <span key={g} className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-green-100 text-green-800 text-xs rounded-full font-medium">
                      {g}
                      <button type="button" onClick={(e) => { e.stopPropagation(); removeGoal(g); }}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    ref={goalInputRef}
                    value={goalInput}
                    onChange={(e) => setGoalInput(e.target.value)}
                    onKeyDown={handleGoalKeyDown}
                    onBlur={() => goalInput.trim() && addGoal(goalInput)}
                    placeholder={form.goals.length === 0 ? "Type a custom goal…" : "Add another…"}
                    className="flex-1 min-w-[140px] text-sm outline-none bg-transparent placeholder:text-gray-400"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Start date</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Duration (days, 7–90)</label>
                  <input
                    type="number"
                    min={7}
                    max={90}
                    value={form.durationDays}
                    onChange={(e) => setForm((f) => ({ ...f, durationDays: Math.min(90, Math.max(7, Number(e.target.value))) }))}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4 items-end">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Posts per platform per day (1–3)</label>
                  <div className="flex gap-2">
                    {[1, 2, 3].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, postsPerPlatformPerDay: n }))}
                        className={`flex-1 py-2.5 text-sm font-medium rounded-xl border transition-colors ${
                          form.postsPerPlatformPerDay === n
                            ? "bg-green-600 text-white border-green-600"
                            : "border-gray-200 text-gray-600 hover:border-green-300"
                        }`}
                      >
                        {n}×
                      </button>
                    ))}
                  </div>
                </div>
                <label className="flex items-center gap-2.5 cursor-pointer p-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={form.feedbackLoopEnabled}
                    onChange={(e) => setForm((f) => ({ ...f, feedbackLoopEnabled: e.target.checked }))}
                    className="rounded accent-green-600"
                  />
                  <span className="text-sm text-gray-700">Enable feedback loop</span>
                </label>
              </div>

              {capCents != null && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Budget for this plan (USD, optional)
                    {capCents != null && (
                      <span className="text-gray-400 font-normal ml-1">
                        — {fmt(capCents - totalAllocatedCents)} remaining in campaign
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={form.budgetAllocated}
                      onChange={(e) => setForm((f) => ({ ...f, budgetAllocated: e.target.value }))}
                      placeholder="0.00"
                      className="w-full pl-7 pr-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  {form.budgetAllocated && capCents != null &&
                    Math.round(parseFloat(form.budgetAllocated) * 100) + totalAllocatedCents > capCents && (
                      <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        This would exceed the campaign budget cap by{" "}
                        {fmt(Math.round(parseFloat(form.budgetAllocated) * 100) + totalAllocatedCents - capCents)}.
                      </p>
                    )}
                </div>
              )}

              {!canGenerate && (
                <p className="text-xs text-amber-600">
                  Required:{" "}
                  {[
                    !form.brandProfileId && "brand",
                    !form.agentId && "agent",
                    !form.platforms.length && "at least one platform",
                    !form.goals.length && "at least one goal",
                  ].filter(Boolean).join(", ")}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { setGenerateError(""); generate.mutate(); }}
                  disabled={!canGenerate || generate.isPending}
                  className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-sm font-medium rounded-xl transition-colors disabled:cursor-not-allowed"
                >
                  <Sparkles className="w-4 h-4" />
                  {generate.isPending ? "Generating…" : `Generate ${form.durationDays}-day plan`}
                </button>
                <button
                  onClick={() => { setPanel("none"); setGenerateError(""); }}
                  className="px-5 py-2.5 border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 rounded-xl transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Plan list */}
        {plans.length === 0 && panel === "none" ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
            <p className="text-sm text-gray-500 mb-3">No plans assigned to this campaign yet.</p>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPanel("generate")}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-green-600 hover:underline"
              >
                <Plus className="w-3 h-3" /> Generate a plan
              </button>
              {unlinkedPlans.length > 0 && (
                <>
                  <span className="text-gray-300">or</span>
                  <button
                    onClick={() => setPanel("link")}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:underline"
                  >
                    <Link2 className="w-3 h-3" /> attach an existing one
                  </button>
                </>
              )}
            </div>
          </div>
        ) : plans.length > 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100">
            {plans.map((plan) => (
              <div key={plan.id} className="px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors group">
                <Link href={`/dashboard/plans/${plan.id}`} className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-800 block truncate">{plan.name}</span>
                  <span className="text-xs text-gray-400 capitalize">{plan.status.replace("_", " ")}</span>
                </Link>

                {/* Per-plan budget cell */}
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  {editingBudgetPlan === plan.id ? (
                    <div className="flex items-center gap-1.5">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                        <input
                          autoFocus
                          type="number"
                          min={0}
                          step={0.01}
                          value={planBudgetDrafts[plan.id] ?? ""}
                          onChange={(e) => setPlanBudgetDrafts((d) => ({ ...d, [plan.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") savePlanBudget(plan.id);
                            if (e.key === "Escape") setEditingBudgetPlan(null);
                          }}
                          placeholder="0.00"
                          className="w-24 pl-6 pr-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                      <button
                        onClick={() => savePlanBudget(plan.id)}
                        disabled={updatePlanBudget.isPending}
                        className="p-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingBudgetPlan(null)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingBudgetPlan(plan.id);
                        setPlanBudgetDrafts((d) => ({
                          ...d,
                          [plan.id]: plan.budgetAllocatedCents != null
                            ? (plan.budgetAllocatedCents / 100).toString()
                            : "",
                        }));
                      }}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                        plan.budgetAllocatedCents != null
                          ? "border-gray-200 text-gray-600 hover:border-green-300 hover:text-green-700"
                          : "border-dashed border-gray-300 text-gray-400 hover:border-green-400 hover:text-green-600"
                      }`}
                    >
                      {plan.budgetAllocatedCents != null ? fmt(plan.budgetAllocatedCents) : "+ budget"}
                    </button>
                  )}
                  <Link href={`/dashboard/plans/${plan.id}`} className="text-gray-300 group-hover:text-gray-500 transition-colors">
                    <ArrowLeft className="w-4 h-4 rotate-180" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {overBudget && plans.length > 0 && (
          <p className="mt-2 text-xs text-red-600 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            Plans allocated {fmt(totalAllocatedCents)} total — {fmt(totalAllocatedCents - capCents!)} over the {fmt(capCents!)} cap. Adjust plan budgets above.
          </p>
        )}
      </div>
    </div>
  );
}
