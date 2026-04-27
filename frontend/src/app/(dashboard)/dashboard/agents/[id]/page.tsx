"use client";

import { useState, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Link from "next/link";
import {
  Bot,
  PauseCircle,
  PlayCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Pencil,
  X,
  Check,
} from "lucide-react";

interface Agent {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  silencedAt: string | null;
  silenceReason: string | null;
  brandProfileId: string;
  dietInstructions: string | null;
  systemPromptOverride: string | null;
  createdAt: string;
}

interface AgentLog {
  id: string;
  action: string;
  postId: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

interface Brand {
  id: string;
  name: string;
}

const ACTION_META: Record<string, { label: string; color: string }> = {
  reviewer_pass:   { label: "Reviewer pass",    color: "bg-green-100 text-green-700" },
  reviewer_rewrite:{ label: "Reviewer rewrite",  color: "bg-amber-100 text-amber-700" },
  reviewer_fail:   { label: "Reviewer fail",     color: "bg-red-100 text-red-700" },
  post_published:  { label: "Post published",    color: "bg-blue-100 text-blue-700" },
  agent_silenced:  { label: "Agent silenced",    color: "bg-red-100 text-red-700" },
  agent_resumed:   { label: "Agent resumed",     color: "bg-green-100 text-green-700" },
  token_refreshed: { label: "Token refreshed",   color: "bg-gray-100 text-gray-600" },
};

const ACTION_FILTERS = [
  { value: "", label: "All actions" },
  { value: "reviewer_pass", label: "Pass" },
  { value: "reviewer_rewrite", label: "Rewrite" },
  { value: "reviewer_fail", label: "Fail" },
  { value: "post_published", label: "Published" },
  { value: "agent_silenced", label: "Silenced" },
  { value: "agent_resumed", label: "Resumed" },
  { value: "token_refreshed", label: "Token" },
];

function PayloadViewer({ payload }: { payload: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  const keys = Object.keys(payload);
  if (keys.length === 0) return null;

  // Inline preview for simple single-key payloads
  const preview = keys
    .slice(0, 2)
    .map((k) => {
      const v = payload[k];
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean")
        return `${k}: ${String(v)}`;
      return null;
    })
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {open ? "Hide details" : (preview || "Show details")}
      </button>
      {open && (
        <pre className="mt-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg p-2.5 overflow-x-auto text-gray-600 whitespace-pre-wrap">
          {JSON.stringify(payload, null, 2)}
        </pre>
      )}
    </div>
  );
}

function AgentDetailPageContent() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"overview" | "logs">(
    searchParams.get("tab") === "logs" ? "logs" : "overview",
  );
  const [actionFilter, setActionFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const [silencing, setSilencing] = useState(false);
  const [silenceReason, setSilenceReason] = useState("");
  const [confirmName, setConfirmName] = useState("");
  const [editingAgent, setEditingAgent] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDiet, setEditDiet] = useState("");
  const [editSystemPrompt, setEditSystemPrompt] = useState("");
  const LIMIT = 50;

  const { data: agent, isLoading: agentLoading } = useQuery<Agent>({
    queryKey: ["agent", id],
    queryFn: () => api.get<Agent>(`/agents/${id}`),
  });

  const { data: brands = [] } = useQuery<Brand[]>({
    queryKey: ["brands"],
    queryFn: () => api.get<Brand[]>("/brands"),
  });

  const {
    data: logs = [],
    isLoading: logsLoading,
    refetch: refetchLogs,
  } = useQuery<AgentLog[]>({
    queryKey: ["agent-logs", id, actionFilter, offset],
    queryFn: () =>
      api.get<AgentLog[]>(
        `/agents/${id}/logs?limit=${LIMIT}&offset=${offset}${actionFilter ? `&action=${actionFilter}` : ""}`,
      ),
    enabled: tab === "logs",
  });

  const silence = useMutation({
    mutationFn: ({ reason }: { reason: string }) =>
      api.post(`/agents/${id}/silence`, { reason }),
    onSuccess: () => {
      setSilencing(false);
      setSilenceReason("");
      setConfirmName("");
      qc.invalidateQueries({ queryKey: ["agent", id] });
    },
  });

  const resume = useMutation({
    mutationFn: () => api.post(`/agents/${id}/resume`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agent", id] }),
  });

  const updateAgent = useMutation({
    mutationFn: (body: { name?: string; description?: string; dietInstructions?: string; systemPromptOverride?: string }) =>
      api.put(`/agents/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent", id] });
      setEditingAgent(false);
    },
  });

  const startEditAgent = () => {
    if (!agent) return;
    setEditName(agent.name);
    setEditDescription(agent.description ?? "");
    setEditDiet(agent.dietInstructions ?? "");
    setEditSystemPrompt(agent.systemPromptOverride ?? "");
    setEditingAgent(true);
  };

  const getBrandName = (brandId: string) =>
    brands.find((b) => b.id === brandId)?.name ?? brandId;

  if (agentLoading)
    return <div className="text-sm text-gray-500 animate-pulse">Loading agent...</div>;
  if (!agent) return <div className="text-sm text-gray-500">Agent not found.</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/dashboard/agents"
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              ← Agents
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                agent.isActive ? "bg-green-50" : "bg-red-50"
              }`}
            >
              <Bot className={`w-5 h-5 ${agent.isActive ? "text-green-600" : "text-red-500"}`} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{agent.name}</h1>
              <p className="text-sm text-gray-400">Brand: {getBrandName(agent.brandProfileId)}</p>
            </div>
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                agent.isActive
                  ? "bg-green-100 text-green-700 border border-green-200"
                  : "bg-red-100 text-red-700 border border-red-200"
              }`}
            >
              {agent.isActive ? "Active" : "Silenced"}
            </span>
          </div>
        </div>

        <div>
          {agent.isActive ? (
            <button
              onClick={() => setSilencing(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-xl hover:bg-red-50 transition-colors"
            >
              <PauseCircle className="w-3.5 h-3.5" /> Silence agent
            </button>
          ) : (
            <button
              onClick={() => resume.mutate()}
              disabled={resume.isPending}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-green-700 bg-white border border-green-200 rounded-xl hover:bg-green-50 transition-colors disabled:opacity-50"
            >
              <PlayCircle className="w-3.5 h-3.5" /> Resume agent
            </button>
          )}
        </div>
      </div>

      {/* Silence reason banner */}
      {!agent.isActive && agent.silenceReason && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Silenced: {agent.silenceReason}</span>
        </div>
      )}

      {/* Silence confirmation */}
      {silencing && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 space-y-3">
          <p className="text-sm font-medium text-red-800">
            This will cancel all queued posts from this agent. Type &ldquo;{agent.name}&rdquo; to confirm.
          </p>
          <input
            placeholder={`Type "${agent.name}" to confirm`}
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            className="w-full px-3.5 py-2.5 border border-red-300 bg-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
          />
          <input
            placeholder="Reason for silencing (required)"
            value={silenceReason}
            onChange={(e) => setSilenceReason(e.target.value)}
            className="w-full px-3.5 py-2.5 border border-gray-300 bg-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
          />
          <div className="flex gap-2">
            <button
              onClick={() => silence.mutate({ reason: silenceReason })}
              disabled={confirmName !== agent.name || !silenceReason || silence.isPending}
              className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-xl disabled:opacity-50 font-medium transition-colors"
            >
              {silence.isPending ? "Silencing…" : "Confirm silence"}
            </button>
            <button
              onClick={() => { setSilencing(false); setConfirmName(""); setSilenceReason(""); }}
              className="px-4 py-2 text-sm border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 rounded-xl transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(["overview", "logs"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "logs" ? "Activity Logs" : "Overview"}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === "overview" && (
        <div className="space-y-4">
          {editingAgent ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Edit agent</h3>
                <button onClick={() => setEditingAgent(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                  <input
                    type="text"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="What this agent focuses on"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Diet instructions</label>
                  <textarea
                    rows={3}
                    value={editDiet}
                    onChange={(e) => setEditDiet(e.target.value)}
                    placeholder="Topics or content types to avoid"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">System prompt override</label>
                  <textarea
                    rows={4}
                    value={editSystemPrompt}
                    onChange={(e) => setEditSystemPrompt(e.target.value)}
                    placeholder="Custom system prompt (advanced)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-green-400"
                  />
                </div>
              </div>
              {updateAgent.isError && (
                <p className="text-sm text-red-600">{(updateAgent.error as Error).message}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => updateAgent.mutate({
                    name: editName.trim() || undefined,
                    description: editDescription.trim() || undefined,
                    dietInstructions: editDiet.trim() || undefined,
                    systemPromptOverride: editSystemPrompt.trim() || undefined,
                  })}
                  disabled={!editName.trim() || updateAgent.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  {updateAgent.isPending ? "Saving…" : "Save changes"}
                </button>
                <button
                  onClick={() => setEditingAgent(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100">
              <div className="px-5 py-3 flex justify-end">
                <button
                  onClick={startEditAgent}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-800 transition-colors"
                >
                  <Pencil className="w-3 h-3" /> Edit agent
                </button>
              </div>
              {agent.description && (
                <div className="px-5 py-4">
                  <p className="text-xs font-medium text-gray-400 mb-1">Description</p>
                  <p className="text-sm text-gray-700">{agent.description}</p>
                </div>
              )}
              {agent.dietInstructions && (
                <div className="px-5 py-4">
                  <p className="text-xs font-medium text-gray-400 mb-1">Diet instructions</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{agent.dietInstructions}</p>
                </div>
              )}
              {agent.systemPromptOverride && (
                <div className="px-5 py-4">
                  <p className="text-xs font-medium text-gray-400 mb-1">System prompt override</p>
                  <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono bg-gray-50 p-3 rounded-lg">
                    {agent.systemPromptOverride}
                  </pre>
                </div>
              )}
              <div className="px-5 py-4">
                <p className="text-xs font-medium text-gray-400 mb-1">Created</p>
                <p className="text-sm text-gray-700">
                  {new Date(agent.createdAt).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Logs tab */}
      {tab === "logs" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {ACTION_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => { setActionFilter(f.value); setOffset(0); }}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                  actionFilter === f.value
                    ? "bg-gray-900 text-white"
                    : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {f.label}
              </button>
            ))}
            <button
              onClick={() => refetchLogs()}
              className="ml-auto p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Log list */}
          {logsLoading ? (
            <div className="space-y-2 animate-pulse">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-14 bg-gray-100 rounded-xl" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16 bg-white border border-dashed border-gray-200 rounded-2xl">
              <p className="text-gray-400 text-sm">No log entries{actionFilter ? " for this filter" : " yet"}.</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100">
              {logs.map((log) => {
                const meta = ACTION_META[log.action] ?? { label: log.action, color: "bg-gray-100 text-gray-600" };
                return (
                  <div key={log.id} className="px-5 py-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.color}`}>
                          {meta.label}
                        </span>
                        {log.postId && (
                          <span className="text-xs text-gray-400 font-mono">
                            post {log.postId.slice(0, 8)}…
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">
                        {new Date(log.createdAt).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    {log.payload && Object.keys(log.payload).length > 0 && (
                      <PayloadViewer payload={log.payload} />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {(logs.length === LIMIT || offset > 0) && (
            <div className="flex items-center justify-between text-xs text-gray-500">
              <button
                onClick={() => setOffset(Math.max(0, offset - LIMIT))}
                disabled={offset === 0}
                className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                ← Previous
              </button>
              <span>Showing {offset + 1}–{offset + logs.length}</span>
              <button
                onClick={() => setOffset(offset + LIMIT)}
                disabled={logs.length < LIMIT}
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

export default function AgentDetailPage() {
  return (
    <Suspense>
      <AgentDetailPageContent />
    </Suspense>
  );
}
