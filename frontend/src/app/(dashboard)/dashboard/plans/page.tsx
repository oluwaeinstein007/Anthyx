"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Link from "next/link";
import { Plus, Calendar, ArrowRight, X, Sparkles } from "lucide-react";

const SUGGESTED_GOALS = [
  "Increase brand awareness",
  "Drive website traffic",
  "Grow followers",
  "Build community engagement",
  "Generate leads",
  "Showcase products",
  "Establish thought leadership",
  "Promote content",
];

interface Plan {
  id: string;
  name: string;
  status: string;
  startDate: string;
  endDate: string;
  brandProfileId: string;
  createdAt: string;
}
interface Brand { id: string; name: string; }
interface Agent { id: string; name: string; brandProfileId: string; }
interface SocialAccount { id: string; platform: string; accountHandle: string; }

const STATUS_STYLES: Record<string, string> = {
  generating:     "bg-blue-100 text-blue-700 border border-blue-200",
  pending_review: "bg-amber-100 text-amber-700 border border-amber-200",
  active:         "bg-green-100 text-green-700 border border-green-200",
  completed:      "bg-gray-100 text-gray-600 border border-gray-200",
  paused:         "bg-orange-100 text-orange-700 border border-orange-200",
  failed:         "bg-red-100 text-red-600 border border-red-200",
};

const PLATFORMS = ["x", "instagram", "linkedin", "facebook", "telegram", "tiktok"];

export default function PlansPage() {
  const qc = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [form, setForm] = useState({
    brandProfileId: "",
    agentId: "",
    platforms: [] as string[],
    goals: [] as string[],
    startDate: new Date().toISOString().split("T")[0] ?? "",
    durationDays: 30,
    feedbackLoopEnabled: false,
  });
  const [goalInput, setGoalInput] = useState("");
  const goalInputRef = useRef<HTMLInputElement>(null);

  const { data: plans = [], isLoading } = useQuery<Plan[]>({
    queryKey: ["plans"],
    queryFn: () => api.get<Plan[]>("/plans"),
    refetchInterval: 10_000,
  });
  const { data: brands = [] } = useQuery<Brand[]>({ queryKey: ["brands"], queryFn: () => api.get<Brand[]>("/brands") });
  const { data: agents = [] } = useQuery<Agent[]>({ queryKey: ["agents"], queryFn: () => api.get<Agent[]>("/agents") });

  const generate = useMutation({
    mutationFn: () =>
      api.post("/plans/generate", {
        brandProfileId: form.brandProfileId,
        agentId: form.agentId,
        platforms: form.platforms,
        goals: form.goals,
        startDate: form.startDate,
        durationDays: form.durationDays,
        feedbackLoopEnabled: form.feedbackLoopEnabled,
      }),
    onSuccess: () => { setGenerating(false); qc.invalidateQueries({ queryKey: ["plans"] }); },
  });

  const filteredAgents = agents.filter((a) => !form.brandProfileId || a.brandProfileId === form.brandProfileId);
  const canGenerate = form.brandProfileId && form.agentId && form.platforms.length > 0 && form.goals.length > 0;

  const addGoal = (goal: string) => {
    const trimmed = goal.trim();
    if (trimmed && !form.goals.includes(trimmed)) {
      setForm({ ...form, goals: [...form.goals, trimmed] });
    }
    setGoalInput("");
  };

  const removeGoal = (goal: string) =>
    setForm({ ...form, goals: form.goals.filter((g) => g !== goal) });

  const handleGoalKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addGoal(goalInput);
    } else if (e.key === "Backspace" && !goalInput && form.goals.length > 0) {
      removeGoal(form.goals[form.goals.length - 1]!);
    }
  };

  const togglePlatform = (p: string) =>
    setForm({ ...form, platforms: form.platforms.includes(p) ? form.platforms.filter((x) => x !== p) : [...form.platforms, p] });

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Marketing Plans</h1>
          <p className="text-sm text-gray-500 mt-1">AI-generated content calendars (7–90 days).</p>
        </div>
        <button
          onClick={() => setGenerating(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" /> Generate plan
        </button>
      </div>

      {/* Generate form */}
      {generating && (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 text-sm">New content plan</h2>
                <p className="text-xs text-gray-400">AI will generate a full content calendar</p>
              </div>
            </div>
            <button onClick={() => setGenerating(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-6 space-y-5">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Brand</label>
                <select
                  value={form.brandProfileId}
                  onChange={(e) => setForm({ ...form, brandProfileId: e.target.value, agentId: "" })}
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
                  onChange={(e) => setForm({ ...form, agentId: e.target.value })}
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
              {/* Suggested goals */}
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {SUGGESTED_GOALS.map((g) => {
                  const active = form.goals.includes(g);
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => active ? removeGoal(g) : addGoal(g)}
                      className={`px-3 py-1 text-xs rounded-full border font-medium transition-colors ${
                        active
                          ? "bg-green-600 text-white border-green-600"
                          : "border-gray-200 text-gray-500 hover:border-green-300 hover:text-green-700"
                      }`}
                    >
                      {active && <span className="mr-1">✓</span>}{g}
                    </button>
                  );
                })}
              </div>
              {/* Tag input with selected goals */}
              <div
                className="flex flex-wrap gap-1.5 min-h-[42px] px-3 py-2 border border-gray-300 rounded-xl focus-within:ring-2 focus-within:ring-green-500 cursor-text"
                onClick={() => goalInputRef.current?.focus()}
              >
                {form.goals.filter((g) => !SUGGESTED_GOALS.includes(g)).map((g) => (
                  <span key={g} className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-green-100 text-green-800 text-xs rounded-full font-medium">
                    {g}
                    <button type="button" onClick={(e) => { e.stopPropagation(); removeGoal(g); }} className="hover:text-green-600">
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
                  placeholder={form.goals.length === 0 ? "Type a custom goal and press Enter…" : "Add another…"}
                  className="flex-1 min-w-[140px] text-sm outline-none bg-transparent placeholder:text-gray-400"
                />
              </div>
              {form.goals.length > 0 && (
                <p className="text-xs text-gray-400 mt-1">{form.goals.length} goal{form.goals.length > 1 ? "s" : ""} selected</p>
              )}
            </div>

            <div className="grid md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Start date</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Duration <span className="text-gray-400 font-normal">(days, 7–90)</span>
                </label>
                <input
                  type="number"
                  min={7}
                  max={90}
                  value={form.durationDays}
                  onChange={(e) => setForm({ ...form, durationDays: Math.min(90, Math.max(7, Number(e.target.value))) })}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer p-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
                <input
                  type="checkbox"
                  checked={form.feedbackLoopEnabled}
                  onChange={(e) => setForm({ ...form, feedbackLoopEnabled: e.target.checked })}
                  className="rounded accent-green-600"
                />
                <span className="text-sm text-gray-700">Enable feedback loop</span>
              </label>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => generate.mutate()}
                disabled={!canGenerate || generate.isPending}
                className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-sm font-medium rounded-xl transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                {generate.isPending ? "Generating…" : `Generate ${form.durationDays}-day plan`}
              </button>
              <button onClick={() => setGenerating(false)} className="px-5 py-2.5 border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 rounded-xl transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plan list */}
      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl" />)}
        </div>
      ) : plans.length === 0 ? (
        <div className="text-center py-20 bg-white border border-dashed border-gray-200 rounded-2xl">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-7 h-7 text-gray-400" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">No plans yet</h3>
          <p className="text-sm text-gray-500 mb-5 max-w-xs mx-auto">Generate your first AI-powered 30-day content calendar.</p>
          <button
            onClick={() => setGenerating(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Sparkles className="w-4 h-4" /> Generate first plan
          </button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100">
          {plans.map((plan) => (
            <Link
              key={plan.id}
              href={`/dashboard/plans/${plan.id}`}
              className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors group"
            >
              <div className="flex items-center gap-4">
                <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center shrink-0">
                  <Calendar className="w-4.5 h-4.5 text-gray-500" style={{ width: 18, height: 18 }} />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">{plan.name}</h3>
                  <p className="text-xs text-gray-400">
                    {new Date(plan.startDate).toLocaleDateString()} – {new Date(plan.endDate).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_STYLES[plan.status] ?? "bg-gray-100 text-gray-600"}`}>
                  {plan.status.replace("_", " ")}
                </span>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
