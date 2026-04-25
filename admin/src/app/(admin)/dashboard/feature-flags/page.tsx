"use client";

import { useEffect, useState } from "react";
import { Flag, Plus, X } from "lucide-react";
import { api } from "@/lib/api";

interface FeatureFlag {
  id: string;
  flagName: string;
  enabledGlobally: boolean;
  enabledForOrgs: string[];
  disabledForOrgs: string[];
  createdAt: string;
}

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newFlagName, setNewFlagName] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    api.get<FeatureFlag[]>("/admin/feature-flags")
      .then(setFlags)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function toggleGlobal(flag: FeatureFlag) {
    setSaving(flag.id);
    try {
      await api.put(`/admin/feature-flags/${flag.flagName}`, { enabledGlobally: !flag.enabledGlobally });
      setFlags((prev) => prev.map((f) => f.id === flag.id ? { ...f, enabledGlobally: !f.enabledGlobally } : f));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(null);
    }
  }

  async function createFlag() {
    if (!newFlagName.trim()) return;
    setSaving("new");
    try {
      await api.put(`/admin/feature-flags/${newFlagName.trim().toLowerCase().replace(/\s+/g, "_")}`, {
        enabledGlobally: false,
      });
      const updated = await api.get<FeatureFlag[]>("/admin/feature-flags");
      setFlags(updated);
      setNewFlagName("");
      setShowNew(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Feature Flags</h1>
          <p className="text-sm text-gray-500 mt-1">Toggle features globally or per organisation</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" /> New flag
        </button>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-950 border border-red-800 text-red-400 text-sm">{error}</div>}

      {showNew && (
        <div className="mb-4 p-4 bg-gray-900 border border-gray-800 rounded-xl flex items-center gap-3">
          <Flag className="w-4 h-4 text-gray-500 shrink-0" />
          <input
            autoFocus
            value={newFlagName}
            onChange={(e) => setNewFlagName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") createFlag(); if (e.key === "Escape") setShowNew(false); }}
            placeholder="flag_name"
            className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none"
          />
          <button onClick={createFlag} disabled={saving === "new"} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold">
            {saving === "new" ? "…" : "Create"}
          </button>
          <button onClick={() => setShowNew(false)} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Loading…</div>
        ) : flags.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">No feature flags yet</div>
        ) : (
          <div className="divide-y divide-gray-800">
            {flags.map((flag) => (
              <div key={flag.id} className="px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="font-mono text-sm font-medium text-white">{flag.flagName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {flag.enabledForOrgs.length > 0 && `On for ${flag.enabledForOrgs.length} org(s). `}
                    {flag.disabledForOrgs.length > 0 && `Off for ${flag.disabledForOrgs.length} org(s).`}
                  </p>
                </div>
                <button
                  onClick={() => toggleGlobal(flag)}
                  disabled={saving === flag.id}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    flag.enabledGlobally ? "bg-red-600" : "bg-gray-700"
                  } ${saving === flag.id ? "opacity-50" : ""}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    flag.enabledGlobally ? "translate-x-6" : "translate-x-1"
                  }`} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
