"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Inbox, Send, RefreshCw } from "lucide-react";

interface ConnectedAccount { id: string; platform: string; handle: string }
interface Message {
  id: string;
  platform: string;
  authorHandle: string;
  content: string;
  createdAt: string;
  replied: boolean;
}

interface InboxResponse {
  messages: Message[];
  connectedAccounts: ConnectedAccount[];
  total: number;
  note?: string;
}

const PLATFORM_COLORS: Record<string, string> = {
  x: "bg-gray-900 text-white",
  instagram: "bg-gradient-to-r from-purple-500 to-pink-500 text-white",
  linkedin: "bg-blue-700 text-white",
  facebook: "bg-blue-600 text-white",
  tiktok: "bg-black text-white",
};

export default function InboxPage() {
  const [selectedPlatform, setSelectedPlatform] = useState<string>("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [replyAccountId, setReplyAccountId] = useState("");

  const { data, isLoading, refetch, isRefetching } = useQuery<InboxResponse>({
    queryKey: ["inbox", selectedPlatform],
    queryFn: () => api.get(`/inbox${selectedPlatform ? `?platform=${selectedPlatform}` : ""}`),
  });

  const { mutate: sendReply, isPending: replying } = useMutation({
    mutationFn: ({ messageId, content, platform, socialAccountId }: {
      messageId: string; content: string; platform: string; socialAccountId: string;
    }) => api.post(`/inbox/${messageId}/reply`, { content, platform, socialAccountId }),
    onSuccess: () => {
      setReplyingTo(null);
      setReplyContent("");
    },
  });

  const accounts = data?.connectedAccounts ?? [];
  const messages = data?.messages ?? [];

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Engagement Inbox</h1>
          <p className="text-sm text-gray-500 mt-1">Cross-platform mentions, comments, and messages</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isRefetching}
          className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl text-sm text-gray-600 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isRefetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Platform filter tabs */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setSelectedPlatform("")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            !selectedPlatform ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          All platforms
        </button>
        {accounts.map((acc) => (
          <button
            key={acc.id}
            onClick={() => setSelectedPlatform(acc.platform)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors capitalize ${
              selectedPlatform === acc.platform
                ? (PLATFORM_COLORS[acc.platform] ?? "bg-gray-900 text-white")
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {acc.platform} · @{acc.handle}
          </button>
        ))}
      </div>

      {data?.note && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-xs text-amber-700 font-medium">Integration in progress</p>
          <p className="text-xs text-amber-600 mt-0.5">{data.note}</p>
        </div>
      )}

      {isLoading && <div className="text-sm text-gray-400 py-8 text-center">Loading messages…</div>}

      {!isLoading && messages.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Inbox className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-sm font-semibold text-gray-700 mb-1">
            {accounts.length === 0 ? "No connected accounts" : "Inbox is empty"}
          </p>
          <p className="text-xs text-gray-400 max-w-xs mx-auto">
            {accounts.length === 0
              ? "Connect social accounts in Accounts to see messages here."
              : "No new mentions or comments. Check back later."}
          </p>
        </div>
      )}

      <div className="space-y-3">
        {messages.map((msg) => (
          <div key={msg.id} className="bg-white border border-gray-200 rounded-2xl p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${PLATFORM_COLORS[msg.platform] ?? "bg-gray-100 text-gray-600"}`}>
                    {msg.platform}
                  </span>
                  <span className="text-xs text-gray-500">@{msg.authorHandle}</span>
                  <span className="text-xs text-gray-300">·</span>
                  <span className="text-xs text-gray-400">{new Date(msg.createdAt).toLocaleString()}</span>
                  {msg.replied && (
                    <span className="text-xs text-green-600 font-medium">✓ Replied</span>
                  )}
                </div>
                <p className="text-sm text-gray-800">{msg.content}</p>
              </div>
              {!msg.replied && (
                <button
                  onClick={() => {
                    setReplyingTo(msg.id);
                    setReplyAccountId(accounts.find((a) => a.platform === msg.platform)?.id ?? "");
                  }}
                  className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-medium text-gray-600 transition-colors"
                >
                  <Send className="w-3 h-3" /> Reply
                </button>
              )}
            </div>

            {replyingTo === msg.id && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Write a reply…"
                  rows={3}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                />
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => sendReply({ messageId: msg.id, content: replyContent, platform: msg.platform, socialAccountId: replyAccountId })}
                    disabled={replying || !replyContent.trim() || !replyAccountId}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white rounded-lg text-xs font-semibold transition-colors"
                  >
                    {replying ? "Sending…" : "Send reply"}
                  </button>
                  <button
                    onClick={() => { setReplyingTo(null); setReplyContent(""); }}
                    className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
