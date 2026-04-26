"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { Activity, RefreshCw, CheckCircle2, AlertCircle, Clock, Zap } from "lucide-react";

interface QueueStat {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

const STATUS_CONFIG = [
  { key: "active" as const, label: "Active", icon: Zap, color: "text-blue-400", bg: "bg-blue-900/30" },
  { key: "waiting" as const, label: "Waiting", icon: Clock, color: "text-yellow-400", bg: "bg-yellow-900/30" },
  { key: "delayed" as const, label: "Delayed", icon: Clock, color: "text-purple-400", bg: "bg-purple-900/30" },
  { key: "completed" as const, label: "Completed", icon: CheckCircle2, color: "text-green-400", bg: "bg-green-900/30" },
  { key: "failed" as const, label: "Failed", icon: AlertCircle, color: "text-red-400", bg: "bg-red-900/30" },
];

export default function QueuesPage() {
  const [stats, setStats] = useState<QueueStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const data = await api.get<QueueStat[]>("/admin/queues");
      setStats(data);
      setLastRefresh(new Date());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load queue stats");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalFailed = stats.reduce((s, q) => s + q.failed, 0);
  const totalActive = stats.reduce((s, q) => s + q.active, 0);

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Queues</h1>
          <p className="text-sm text-gray-500 mt-1">
            BullMQ worker health
            {lastRefresh && (
              <span className="ml-2 text-gray-600">· Last updated {lastRefresh.toLocaleTimeString()}</span>
            )}
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-gray-400 hover:text-white hover:border-gray-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-950 border border-red-800 text-red-400 text-sm">{error}</div>}

      {totalActive > 0 && (
        <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-blue-950 border border-blue-800 text-blue-400 text-sm">
          <Zap className="w-4 h-4" />
          {totalActive} job{totalActive !== 1 ? "s" : ""} currently active across all queues
        </div>
      )}
      {totalFailed > 0 && (
        <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-red-950 border border-red-800 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" />
          {totalFailed} failed job{totalFailed !== 1 ? "s" : ""} — check logs for details
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-900 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {stats.map((q) => (
            <div key={q.name} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center gap-2.5 mb-4">
                <Activity className="w-4 h-4 text-gray-400" />
                <h2 className="text-sm font-semibold text-white">{q.name}</h2>
                {q.active > 0 && (
                  <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-900/40 text-blue-400 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    processing
                  </span>
                )}
              </div>
              <div className="grid grid-cols-5 gap-3">
                {STATUS_CONFIG.map(({ key, label, icon: Icon, color, bg }) => (
                  <div key={key} className={`rounded-lg p-3 ${bg}`}>
                    <div className={`flex items-center gap-1.5 mb-1 ${color}`}>
                      <Icon className="w-3 h-3" />
                      <span className="text-xs font-medium">{label}</span>
                    </div>
                    <p className={`text-xl font-bold ${color}`}>{q[key].toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
