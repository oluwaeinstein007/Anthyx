"use client";

import { useState } from "react";

interface OverageCapSettingProps {
  currentCapCents: number;
  onSave: (capCents: number) => Promise<void>;
}

const PRESETS = [0, 1000, 2500, 5000, 10000, 25000];

export function OverageCapSetting({ currentCapCents, onSave }: OverageCapSettingProps) {
  const [capCents, setCapCents] = useState(currentCapCents);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setLoading(true);
    setSaved(false);
    try {
      await onSave(capCents);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Monthly overage cap</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Posting stops when overage charges reach this limit.
          Set to $0 to disable overage entirely.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => setCapCents(p)}
            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
              capCents === p
                ? "bg-blue-600 text-white border-blue-600"
                : "border-gray-300 text-gray-700 hover:border-blue-400"
            }`}
          >
            {p === 0 ? "No overage" : `$${(p / 100).toFixed(0)}`}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 text-sm text-gray-700">
          <span>$</span>
          <input
            type="number"
            min={0}
            max={100000}
            step={100}
            value={(capCents / 100).toFixed(0)}
            onChange={(e) => setCapCents(Math.round(parseFloat(e.target.value || "0") * 100))}
            className="w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <span className="text-gray-400">/ month</span>
        </div>
        <button
          onClick={handleSave}
          disabled={loading || capCents === currentCapCents}
          className="px-4 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Saving..." : saved ? "Saved ✓" : "Save"}
        </button>
      </div>
    </div>
  );
}
