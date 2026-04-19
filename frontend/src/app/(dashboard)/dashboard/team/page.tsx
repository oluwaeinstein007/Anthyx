"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Users, Plus, X, Trash2, Mail } from "lucide-react";

interface Participant {
  id: string;
  userId: string;
  brandProfileId: string | null;
  agentId: string | null;
  stage: string;
  canEdit: boolean;
  canVeto: boolean;
  notifyOn: string[];
  createdAt: string;
}

interface Brand { id: string; name: string; }
interface Agent { id: string; name: string; }

const STAGES = ["plan_review", "hitl", "legal_review", "analytics_only"];
const NOTIFY_OPTIONS = ["post_published", "post_vetoed", "post_approved", "usage_alert", "brand_voice_drift"];

const STAGE_LABELS: Record<string, string> = {
  plan_review: "Plan Review",
  hitl: "Human-in-the-Loop",
  legal_review: "Legal Review",
  analytics_only: "Analytics Only",
};

export default function TeamPage() {
  const qc = useQueryClient();
  const [inviting, setInviting] = useState(false);
  const [form, setForm] = useState({
    email: "",
    stage: "hitl",
    brandProfileId: "",
    agentId: "",
    canEdit: false,
    canVeto: false,
    notifyOn: [] as string[],
  });

  const { data: participants = [], isLoading } = useQuery<Participant[]>({
    queryKey: ["team"],
    queryFn: () => api.get<Participant[]>("/team"),
  });
  const { data: brands = [] } = useQuery<Brand[]>({ queryKey: ["brands"], queryFn: () => api.get<Brand[]>("/brands") });
  const { data: agents = [] } = useQuery<Agent[]>({ queryKey: ["agents"], queryFn: () => api.get<Agent[]>("/agents") });

  const invite = useMutation({
    mutationFn: () => api.post("/team/invite", {
      email: form.email,
      stage: form.stage,
      brandProfileId: form.brandProfileId || null,
      agentId: form.agentId || null,
      canEdit: form.canEdit,
      canVeto: form.canVeto,
      notifyOn: form.notifyOn,
    }),
    onSuccess: () => {
      setInviting(false);
      setForm({ email: "", stage: "hitl", brandProfileId: "", agentId: "", canEdit: false, canVeto: false, notifyOn: [] });
      qc.invalidateQueries({ queryKey: ["team"] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/team/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team"] }),
  });

  const toggleNotify = (event: string) => {
    setForm((f) => ({
      ...f,
      notifyOn: f.notifyOn.includes(event) ? f.notifyOn.filter((x) => x !== event) : [...f.notifyOn, event],
    }));
  };

  const getBrandName = (id: string | null) => brands.find((b) => b.id === id)?.name ?? "All brands";
  const getAgentName = (id: string | null) => agents.find((a) => a.id === id)?.name ?? "All agents";

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team</h1>
          <p className="text-sm text-gray-500 mt-1">Invite collaborators with role-based workflow access.</p>
        </div>
        <button
          onClick={() => setInviting(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" /> Invite member
        </button>
      </div>

      {inviting && (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 text-sm">Invite team member</h2>
            <button onClick={() => setInviting(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          </div>
          <div className="p-6 space-y-5">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Email address</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="colleague@company.com"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Workflow stage</label>
                <select
                  value={form.stage}
                  onChange={(e) => setForm({ ...form, stage: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                >
                  {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Brand scope (optional)</label>
                <select
                  value={form.brandProfileId}
                  onChange={(e) => setForm({ ...form, brandProfileId: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                >
                  <option value="">All brands</option>
                  {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Agent scope (optional)</label>
                <select
                  value={form.agentId}
                  onChange={(e) => setForm({ ...form, agentId: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                >
                  <option value="">All agents</option>
                  {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Permissions</label>
              <div className="flex gap-4">
                {[
                  { key: "canEdit", label: "Can edit posts" },
                  { key: "canVeto", label: "Can veto posts" },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form[key as "canEdit" | "canVeto"]}
                      onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                      className="rounded accent-green-600"
                    />
                    <span className="text-sm text-gray-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Notify on</label>
              <div className="flex flex-wrap gap-2">
                {NOTIFY_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggleNotify(opt)}
                    className={`px-3 py-1.5 text-xs rounded-xl border font-medium transition-colors ${
                      form.notifyOn.includes(opt)
                        ? "bg-green-600 text-white border-green-600"
                        : "border-gray-200 text-gray-600 hover:border-green-300 hover:text-green-700"
                    }`}
                  >
                    {opt.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => invite.mutate()}
                disabled={!form.email || invite.isPending}
                className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-sm font-medium rounded-xl transition-colors"
              >
                <Mail className="w-4 h-4" />
                {invite.isPending ? "Sending invite…" : "Send invite"}
              </button>
              <button onClick={() => setInviting(false)} className="px-5 py-2.5 border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 rounded-xl transition-colors">
                Cancel
              </button>
            </div>
            {invite.isError && (
              <p className="text-xs text-red-600">Failed to send invite. Check the seat limit on your plan.</p>
            )}
            {invite.isSuccess && (
              <p className="text-xs text-green-600">Invite sent! They&apos;ll receive a link to accept.</p>
            )}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-2xl" />)}
        </div>
      ) : participants.length === 0 ? (
        <div className="text-center py-20 bg-white border border-dashed border-gray-200 rounded-2xl">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Users className="w-7 h-7 text-gray-400" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">No team members yet</h3>
          <p className="text-sm text-gray-500 mb-5 max-w-xs mx-auto">Invite collaborators to review, approve, or monitor content.</p>
          <button
            onClick={() => setInviting(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" /> Invite first member
          </button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100">
          {participants.map((p) => (
            <div key={p.id} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors group">
              <div className="flex items-center gap-4">
                <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 text-sm">{p.userId}</span>
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full font-medium">
                      {STAGE_LABELS[p.stage] ?? p.stage}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    {getBrandName(p.brandProfileId)} · {getAgentName(p.agentId)}
                    {p.canEdit && " · can edit"}
                    {p.canVeto && " · can veto"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => remove.mutate(p.id)}
                className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
