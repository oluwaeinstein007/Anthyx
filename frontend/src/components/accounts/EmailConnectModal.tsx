"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { X, Info } from "lucide-react";

export function EmailConnectModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [recipients, setRecipients] = useState("");

  const canSubmit = recipients.trim().length > 0;

  const connect = useMutation({
    mutationFn: () =>
      api.post("/accounts/email", {
        displayName: displayName.trim() || undefined,
        recipients,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      onClose();
    },
  });

  const inputCls =
    "w-full rounded-xl border border-gray-200 text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-amber-50">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Connect Email List</h2>
              <p className="text-xs text-gray-500">Add a recipient list for email campaigns</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Info banner */}
          <div className="flex gap-2.5 p-3 bg-amber-50 rounded-xl border border-amber-100">
            <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              Email is sent through the server's configured mail provider (SMTP, SendGrid, or Mailgun).
              You only need to add the recipient addresses — no API keys required here.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              List Name (optional)
            </label>
            <input
              className={inputCls}
              type="text"
              placeholder="Newsletter subscribers"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="off"
            />
            <p className="text-xs text-gray-400 mt-1">
              A label to identify this list in the dashboard
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Recipient Addresses
            </label>
            <textarea
              className={`${inputCls} h-28 resize-none font-mono text-xs`}
              placeholder={"alice@example.com, bob@example.com,\ncarol@example.com"}
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">
              Comma or newline separated. Each recipient receives a separate email.
            </p>
          </div>

          {connect.isError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              {connect.error instanceof Error ? connect.error.message : "Connection failed"}
            </p>
          )}

          <div className="flex justify-end gap-2.5 pt-1">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-xl text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => connect.mutate()}
              disabled={!canSubmit || connect.isPending}
              className="px-4 py-2 text-sm rounded-xl text-white font-medium disabled:opacity-50 transition-colors bg-amber-600 hover:bg-amber-700"
            >
              {connect.isPending ? "Saving…" : "Save List"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
