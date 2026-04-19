"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Link from "next/link";
import { Plus, Megaphone, ArrowRight, X, Trash2 } from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  goals: string[];
  budgetCapCents: number | null;
  createdAt: string;
}

export default function CampaignsPage() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", goals: [] as string[], budgetCap: "" });
  const [goalInput, setGoalInput] = useState("");

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ["campaigns"],
    queryFn: () => api.get<Campaign[]>("/campaigns"),
  });

  const create = useMutation({
    mutationFn: () =>
      api.post("/campaigns", {
        name: form.name,
        goals: form.goals,
        budgetCapCents: form.budgetCap ? Math.round(parseFloat(form.budgetCap) * 100) : null,
      }),
    onSuccess: () => {
      setCreating(false);
      setForm({ name: "", goals: [], budgetCap: "" });
      qc.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/campaigns/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });

  const addGoal = (g: string) => {
    const t = g.trim();
    if (t && !form.goals.includes(t)) setForm({ ...form, goals: [...form.goals, t] });
    setGoalInput("");
  };

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
          <p className="text-sm text-gray-500 mt-1">Group marketing plans under campaign objectives.</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" /> New campaign
        </button>
      </div>

      {creating && (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 text-sm">New campaign</h2>
            <button onClick={() => setCreating(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Campaign name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Q3 Product Launch"
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Goals</label>
              <div className="flex flex-wrap gap-1.5 mb-2 min-h-[40px] px-3 py-2 border border-gray-300 rounded-xl focus-within:ring-2 focus-within:ring-green-500">
                {form.goals.map((g) => (
                  <span key={g} className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-green-100 text-green-800 text-xs rounded-full font-medium">
                    {g}
                    <button onClick={() => setForm({ ...form, goals: form.goals.filter((x) => x !== g) })}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <input
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addGoal(goalInput); } }}
                  onBlur={() => goalInput.trim() && addGoal(goalInput)}
                  placeholder={form.goals.length === 0 ? "Type a goal and press Enter…" : "Add another…"}
                  className="flex-1 min-w-[160px] text-sm outline-none bg-transparent placeholder:text-gray-400"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Budget cap (optional, USD)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.budgetCap}
                onChange={(e) => setForm({ ...form, budgetCap: e.target.value })}
                placeholder="e.g. 5000.00"
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => create.mutate()}
                disabled={!form.name || create.isPending}
                className="px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-sm font-medium rounded-xl transition-colors"
              >
                {create.isPending ? "Creating…" : "Create campaign"}
              </button>
              <button onClick={() => setCreating(false)} className="px-5 py-2.5 border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 rounded-xl transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl" />)}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-20 bg-white border border-dashed border-gray-200 rounded-2xl">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Megaphone className="w-7 h-7 text-gray-400" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">No campaigns yet</h3>
          <p className="text-sm text-gray-500 mb-5 max-w-xs mx-auto">Group your marketing plans under campaign objectives.</p>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" /> Create first campaign
          </button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100">
          {campaigns.map((c) => (
            <div key={c.id} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors group">
              <Link href={`/dashboard/campaigns/${c.id}`} className="flex items-center gap-4 flex-1 min-w-0">
                <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center shrink-0">
                  <Megaphone className="w-4.5 h-4.5 text-green-600" style={{ width: 18, height: 18 }} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-medium text-gray-900 truncate">{c.name}</h3>
                  <p className="text-xs text-gray-400">
                    {c.goals.length > 0 ? c.goals.slice(0, 2).join(" · ") + (c.goals.length > 2 ? ` +${c.goals.length - 2}` : "") : "No goals set"}
                    {c.budgetCapCents ? ` · $${(c.budgetCapCents / 100).toLocaleString()} budget` : ""}
                  </p>
                </div>
              </Link>
              <div className="flex items-center gap-2 shrink-0">
                <Link href={`/dashboard/campaigns/${c.id}`} className="p-1.5 rounded-lg text-gray-300 group-hover:text-gray-500 transition-colors">
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <button
                  onClick={() => remove.mutate(c.id)}
                  className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
