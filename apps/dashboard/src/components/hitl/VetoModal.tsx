"use client";

import { useState } from "react";

const VETO_REASONS = [
  "Off-brand tone",
  "Factually incorrect",
  "Sensitive topic",
  "Legal / compliance issue",
  "Timing inappropriate",
  "Other",
];

interface VetoModalProps {
  postId: string;
  onConfirm: (postId: string, reason: string) => Promise<void>;
  onCancel: () => void;
}

export function VetoModal({ postId, onConfirm, onCancel }: VetoModalProps) {
  const [reason, setReason] = useState(VETO_REASONS[0]!);
  const [custom, setCustom] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    const finalReason = reason === "Other" ? custom.trim() : reason;
    if (!finalReason) return;
    setLoading(true);
    try {
      await onConfirm(postId, finalReason);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Veto post</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-md border border-gray-300 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400"
          >
            {VETO_REASONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        {reason === "Other" && (
          <textarea
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Describe the issue..."
            rows={3}
            className="w-full rounded-md border border-gray-300 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400"
          />
        )}
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-md text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || (reason === "Other" && !custom.trim())}
            className="px-4 py-2 text-sm rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? "Vetoing..." : "Veto post"}
          </button>
        </div>
      </div>
    </div>
  );
}
