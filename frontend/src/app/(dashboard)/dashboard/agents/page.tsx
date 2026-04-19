"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Link from "next/link";
import { Bot, PauseCircle, PlayCircle, AlertTriangle, ArrowRight } from "lucide-react";

interface Agent {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  silencedAt: string | null;
  silenceReason: string | null;
  brandProfileId: string;
  dietInstructions: string | null;
}

interface Brand {
  id: string;
  name: string;
}

export default function AgentsPage() {
  const qc = useQueryClient();
  const [silencing, setSilencing] = useState<string | null>(null);
  const [silenceReason, setSilenceReason] = useState("");
  const [confirmName, setConfirmName] = useState("");

  const { data: agents = [], isLoading } = useQuery<Agent[]>({
    queryKey: ["agents"],
    queryFn: () => api.get<Agent[]>("/agents"),
  });

  const { data: brands = [] } = useQuery<Brand[]>({
    queryKey: ["brands"],
    queryFn: () => api.get<Brand[]>("/brands"),
  });

  const silence = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/agents/${id}/silence`, { reason }),
    onSuccess: () => {
      setSilencing(null);
      setSilenceReason("");
      setConfirmName("");
      qc.invalidateQueries({ queryKey: ["agents"] });
    },
  });

  const resume = useMutation({
    mutationFn: (id: string) => api.post(`/agents/${id}/resume`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agents"] }),
  });

  const getBrandName = (id: string) => brands.find((b) => b.id === id)?.name ?? id;

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Agents</h1>
        <p className="text-sm text-gray-500 mt-1">Named AI personas that generate and publish content for your brands.</p>
      </div>

      {agents.length === 0 ? (
        <div className="text-center py-20 bg-white border border-dashed border-gray-200 rounded-2xl">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Bot className="w-7 h-7 text-gray-400" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">No agents yet</h3>
          <p className="text-sm text-gray-500 max-w-xs mx-auto">
            Agents are created automatically when you generate a content plan. Create a brand and plan to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className={`bg-white border rounded-2xl overflow-hidden transition-colors ${
                !agent.isActive ? "border-red-200" : "border-gray-200"
              }`}
            >
              <div className="p-5 flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    agent.isActive ? "bg-green-50" : "bg-red-50"
                  }`}>
                    <Bot className={`w-5 h-5 ${agent.isActive ? "text-green-600" : "text-red-500"}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5 mb-0.5">
                      <Link
                        href={`/dashboard/agents/${agent.id}`}
                        className="font-semibold text-gray-900 hover:text-green-700 transition-colors"
                      >
                        {agent.name}
                      </Link>
                      {!agent.isActive && (
                        <span className="text-xs bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full font-medium">
                          Silenced
                        </span>
                      )}
                      {agent.isActive && (
                        <span className="text-xs bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-medium">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mb-1">Brand: {getBrandName(agent.brandProfileId)}</p>
                    {agent.description && <p className="text-sm text-gray-600">{agent.description}</p>}
                    {agent.silenceReason && (
                      <div className="flex items-center gap-1.5 mt-2 text-xs text-red-600">
                        <AlertTriangle className="w-3 h-3" />
                        Silenced: {agent.silenceReason}
                      </div>
                    )}
                    <Link
                      href={`/dashboard/agents/${agent.id}?tab=logs`}
                      className="inline-flex items-center gap-1 mt-2 text-xs text-gray-400 hover:text-gray-700 transition-colors"
                    >
                      View activity logs <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
                <div className="shrink-0">
                  {agent.isActive ? (
                    <button
                      onClick={() => setSilencing(agent.id)}
                      className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-xl hover:bg-red-50 transition-colors"
                    >
                      <PauseCircle className="w-3.5 h-3.5" /> Silence
                    </button>
                  ) : (
                    <button
                      onClick={() => resume.mutate(agent.id)}
                      disabled={resume.isPending}
                      className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-green-700 bg-white border border-green-200 rounded-xl hover:bg-green-50 transition-colors disabled:opacity-50"
                    >
                      <PlayCircle className="w-3.5 h-3.5" /> Resume
                    </button>
                  )}
                </div>
              </div>

              {/* Silence confirmation panel */}
              {silencing === agent.id && (
                <div className="px-5 pb-5 pt-4 border-t border-red-100 bg-red-50 space-y-3">
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
                      onClick={() => silence.mutate({ id: agent.id, reason: silenceReason })}
                      disabled={confirmName !== agent.name || !silenceReason || silence.isPending}
                      className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-xl disabled:opacity-50 font-medium transition-colors"
                    >
                      {silence.isPending ? "Silencing…" : "Confirm silence"}
                    </button>
                    <button
                      onClick={() => { setSilencing(null); setConfirmName(""); setSilenceReason(""); }}
                      className="px-4 py-2 text-sm border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
