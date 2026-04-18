"use client";

import { useState } from "react";

interface SilenceAgentModalProps {
  agentName: string;
  agentId: string;
  onConfirm: (agentId: string, reason: string) => Promise<void>;
  onCancel: () => void;
}

export function SilenceAgentModal({ agentName, agentId, onConfirm, onCancel }: SilenceAgentModalProps) {
  const [nameInput, setNameInput] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const confirmed = nameInput.trim().toLowerCase() === agentName.trim().toLowerCase();

  async function handleSubmit() {
    if (!confirmed || !reason.trim()) return;
    setLoading(true);
    try {
      await onConfirm(agentId, reason.trim());
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-gray-900">Silence agent</h2>
          <p className="text-sm text-gray-500">
            This will stop <strong>{agentName}</strong> from generating or posting content.
            You can resume it at any time.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Type <span className="font-mono text-gray-900">{agentName}</span> to confirm
          </label>
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder={agentName}
            className="w-full rounded-md border border-gray-300 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why are you silencing this agent?"
            className="w-full rounded-md border border-gray-300 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-400"
          />
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-md text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!confirmed || !reason.trim() || loading}
            className="px-4 py-2 text-sm rounded-md bg-yellow-500 text-white hover:bg-yellow-600 disabled:opacity-50"
          >
            {loading ? "Silencing..." : "Silence agent"}
          </button>
        </div>
      </div>
    </div>
  );
}
