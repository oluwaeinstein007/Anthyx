"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { X, ExternalLink } from "lucide-react";

interface Props {
  onClose: () => void;
}

const STEPS = [
  {
    n: 1,
    text: (
      <>
        Open Telegram and message{" "}
        <a
          href="https://t.me/BotFather"
          target="_blank"
          rel="noreferrer"
          className="text-blue-600 underline inline-flex items-center gap-0.5"
        >
          @BotFather <ExternalLink className="w-3 h-3" />
        </a>
        . Send <code className="bg-gray-100 px-1 rounded text-xs">/newbot</code>, follow the
        prompts, and copy the <strong>HTTP API token</strong> it gives you.
      </>
    ),
  },
  {
    n: 2,
    text: (
      <>
        Add your bot to the <strong>channel or group</strong> you want to post to, then promote it
        to <strong>Admin</strong> with "Post Messages" permission.
      </>
    ),
  },
  {
    n: 3,
    text: (
      <>
        Get the <strong>Chat ID</strong>. For public channels use{" "}
        <code className="bg-gray-100 px-1 rounded text-xs">@channelusername</code>. For private
        channels/groups, forward any message from the chat to{" "}
        <a
          href="https://t.me/userinfobot"
          target="_blank"
          rel="noreferrer"
          className="text-blue-600 underline inline-flex items-center gap-0.5"
        >
          @userinfobot <ExternalLink className="w-3 h-3" />
        </a>{" "}
        — it will reply with the numeric ID (e.g.{" "}
        <code className="bg-gray-100 px-1 rounded text-xs">-1001234567890</code>).
      </>
    ),
  },
];

export function TelegramConnectModal({ onClose }: Props) {
  const qc = useQueryClient();
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");

  const connect = useMutation({
    mutationFn: () =>
      api.post("/accounts/telegram", { botToken: botToken.trim(), chatId: chatId.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-50 flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-sky-500" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Connect Telegram</h2>
              <p className="text-xs text-gray-500">Post to a channel or group via a bot</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Steps */}
          <div className="space-y-3">
            {STEPS.map(({ n, text }) => (
              <div key={n} className="flex gap-3">
                <span className="shrink-0 w-5 h-5 rounded-full bg-sky-100 text-sky-700 text-xs font-bold flex items-center justify-center mt-0.5">
                  {n}
                </span>
                <p className="text-sm text-gray-600 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-100" />

          {/* Form */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Bot Token</label>
              <input
                type="password"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder="1234567890:ABCDefgh..."
                className="w-full rounded-xl border border-gray-200 text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent font-mono"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Channel / Group ID
              </label>
              <input
                type="text"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                placeholder="@yourchannel  or  -1001234567890"
                className="w-full rounded-xl border border-gray-200 text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent font-mono"
              />
            </div>
          </div>

          {connect.isError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              {connect.error instanceof Error ? connect.error.message : "Connection failed"}
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-xl text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => connect.mutate()}
              disabled={!botToken.trim() || !chatId.trim() || connect.isPending}
              className="px-4 py-2 text-sm rounded-xl bg-sky-500 text-white font-medium hover:bg-sky-600 disabled:opacity-50 transition-colors"
            >
              {connect.isPending ? "Connecting…" : "Connect bot"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
