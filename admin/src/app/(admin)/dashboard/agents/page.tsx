"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Bot, Search, PauseCircle, PlayCircle } from "lucide-react";

interface AdminAgent {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  silencedAt: string | null;
  silenceReason: string | null;
  organizationId: string;
  organizationName: string | null;
  brandProfileId: string;
  createdAt: string;
}

export default function AdminAgentsPage() {
  const [agents, setAgents] = useState<AdminAgent[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [acting, setActing] = useState<string | null>(null);

  const load = () =>
    api
      .get<AdminAgent[]>("/admin/agents")
      .then(setAgents)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const filtered = agents.filter((a) => {
    const q = search.toLowerCase();
    return (
      a.name.toLowerCase().includes(q) ||
      (a.organizationName ?? "").toLowerCase().includes(q)
    );
  });

  async function handleSilence(id: string) {
    setActing(id);
    try {
      await api.put(`/admin/agents/${id}/silence`, { reason: "Silenced by admin" });
      setAgents((prev) => prev.map((a) => a.id === id ? { ...a, isActive: false, silenceReason: "Silenced by admin" } : a));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActing(null);
    }
  }

  async function handleResume(id: string) {
    setActing(id);
    try {
      await api.put(`/admin/agents/${id}/resume`, {});
      setAgents((prev) => prev.map((a) => a.id === id ? { ...a, isActive: true, silenceReason: null } : a));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActing(null);
    }
  }

  const activeCount = agents.filter((a) => a.isActive).length;
  const silencedCount = agents.filter((a) => !a.isActive).length;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-bold text-white">Agents</h1>
        <p className="text-sm text-gray-500 mt-1">
          {activeCount} active · {silencedCount} silenced · {agents.length} total
        </p>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-950 border border-red-800 text-red-400 text-sm">{error}</div>}

      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          placeholder="Search by agent or org name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm pl-9 pr-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
        />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">No agents found</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Agent</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Organization</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((agent) => (
                <tr key={agent.id} className="border-b border-gray-800 last:border-0">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${agent.isActive ? "bg-green-900/40" : "bg-red-900/40"}`}>
                        <Bot className={`w-3.5 h-3.5 ${agent.isActive ? "text-green-400" : "text-red-400"}`} />
                      </div>
                      <div>
                        <p className="font-medium text-white">{agent.name}</p>
                        {agent.description && <p className="text-xs text-gray-500">{agent.description}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-400">{agent.organizationName ?? agent.organizationId.slice(0, 8)}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      agent.isActive ? "bg-green-900/50 text-green-400" : "bg-red-900/50 text-red-400"
                    }`}>
                      {agent.isActive ? "active" : "silenced"}
                    </span>
                    {agent.silenceReason && (
                      <p className="text-xs text-gray-600 mt-0.5">{agent.silenceReason}</p>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {agent.isActive ? (
                      <button
                        onClick={() => handleSilence(agent.id)}
                        disabled={acting === agent.id}
                        className="flex items-center gap-1 text-xs text-red-500 hover:text-red-400 ml-auto disabled:opacity-50 transition-colors"
                      >
                        <PauseCircle className="w-3.5 h-3.5" />
                        {acting === agent.id ? "…" : "Silence"}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleResume(agent.id)}
                        disabled={acting === agent.id}
                        className="flex items-center gap-1 text-xs text-green-500 hover:text-green-400 ml-auto disabled:opacity-50 transition-colors"
                      >
                        <PlayCircle className="w-3.5 h-3.5" />
                        {acting === agent.id ? "…" : "Resume"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
