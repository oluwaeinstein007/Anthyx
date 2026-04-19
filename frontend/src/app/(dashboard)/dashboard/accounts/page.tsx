"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Link2, CheckCircle2, AlertTriangle, ExternalLink, Shield } from "lucide-react";
import { TelegramConnectModal } from "@/components/accounts/TelegramConnectModal";
import {
  DiscordConnectModal,
  SlackConnectModal,
  WhatsAppConnectModal,
  BlueskyConnectModal,
  MastodonConnectModal,
} from "@/components/accounts/TokenConnectModal";

interface SocialAccount {
  id: string;
  platform: string;
  accountHandle: string;
  isActive: boolean;
  tokenExpiresAt: string | null;
  createdAt: string;
}

interface PlatformMeta {
  label: string;
  textColor: string;
  bgColor: string;
  dotColor: string;
  connectionType: "oauth" | "modal";
  description: string;
}

const PLATFORM_META: Record<string, PlatformMeta> = {
  x:         { label: "X (Twitter)",  textColor: "text-gray-900",   bgColor: "bg-gray-100",   dotColor: "bg-gray-800",   connectionType: "oauth",  description: "Post tweets, threads, and media" },
  instagram: { label: "Instagram",    textColor: "text-pink-700",   bgColor: "bg-pink-50",    dotColor: "bg-pink-500",   connectionType: "oauth",  description: "Feed posts and carousels via Graph API" },
  linkedin:  { label: "LinkedIn",     textColor: "text-blue-700",   bgColor: "bg-blue-50",    dotColor: "bg-blue-600",   connectionType: "oauth",  description: "Company page and personal updates" },
  facebook:  { label: "Facebook",     textColor: "text-blue-600",   bgColor: "bg-blue-50",    dotColor: "bg-blue-500",   connectionType: "oauth",  description: "Page posts and feed content" },
  telegram:  { label: "Telegram",     textColor: "text-sky-700",    bgColor: "bg-sky-50",     dotColor: "bg-sky-500",    connectionType: "modal",  description: "Channel and group publishing via bot" },
  tiktok:    { label: "TikTok",       textColor: "text-gray-900",   bgColor: "bg-gray-100",   dotColor: "bg-gray-800",   connectionType: "oauth",  description: "Video captions and content publishing" },
  threads:   { label: "Threads",      textColor: "text-gray-800",   bgColor: "bg-gray-100",   dotColor: "bg-gray-700",   connectionType: "oauth",  description: "Instagram-native short-form content" },
  discord:   { label: "Discord",      textColor: "text-indigo-700", bgColor: "bg-indigo-50",  dotColor: "bg-indigo-500", connectionType: "modal",  description: "Channel messages via bot token" },
  slack:     { label: "Slack",        textColor: "text-purple-700", bgColor: "bg-purple-50",  dotColor: "bg-purple-500", connectionType: "modal",  description: "Channel posts via bot OAuth token" },
  whatsapp:  { label: "WhatsApp",     textColor: "text-green-700",  bgColor: "bg-green-50",   dotColor: "bg-green-500",  connectionType: "modal",  description: "Business API broadcast messages" },
  reddit:    { label: "Reddit",       textColor: "text-orange-700", bgColor: "bg-orange-50",  dotColor: "bg-orange-500", connectionType: "oauth",  description: "Subreddit post submission" },
  bluesky:   { label: "Bluesky",      textColor: "text-sky-700",    bgColor: "bg-sky-50",     dotColor: "bg-sky-400",    connectionType: "modal",  description: "AT Protocol posts via app password" },
  mastodon:  { label: "Mastodon",     textColor: "text-violet-700", bgColor: "bg-violet-50",  dotColor: "bg-violet-500", connectionType: "modal",  description: "Fediverse posts on any instance" },
  youtube:   { label: "YouTube",      textColor: "text-red-700",    bgColor: "bg-red-50",     dotColor: "bg-red-500",    connectionType: "oauth",  description: "Community posts and description updates" },
};

const PLATFORM_ORDER = [
  "x", "instagram", "linkedin", "facebook", "tiktok", "threads",
  "reddit", "youtube", "telegram", "discord", "slack", "whatsapp",
  "bluesky", "mastodon",
];

type ModalPlatform = "telegram" | "discord" | "slack" | "whatsapp" | "bluesky" | "mastodon" | null;

export default function AccountsPage() {
  const qc = useQueryClient();
  const [connecting, setConnecting] = useState<string | null>(null);
  const [openModal, setOpenModal] = useState<ModalPlatform>(null);

  const { data: accounts = [], isLoading } = useQuery<SocialAccount[]>({
    queryKey: ["accounts"],
    queryFn: () => api.get<SocialAccount[]>("/accounts"),
  });

  const connect = useMutation({
    mutationFn: (platform: string) =>
      api.get<{ authUrl: string }>(`/accounts/oauth/${platform}`),
    onSuccess: (data) => { window.location.href = data.authUrl; },
    onError: (err) => { alert(err instanceof Error ? err.message : "Failed to get OAuth URL"); },
    onSettled: () => setConnecting(null),
  });

  const disconnect = useMutation({
    mutationFn: (id: string) => api.delete(`/accounts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });

  const connectedPlatforms = new Set(accounts.map((a) => a.platform));

  const isExpiringSoon = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;
  };

  function handleConnect(platform: string) {
    const meta = PLATFORM_META[platform];
    if (!meta) return;
    if (meta.connectionType === "modal") {
      setOpenModal(platform as ModalPlatform);
    } else {
      setConnecting(platform);
      connect.mutate(platform);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Social Accounts</h1>
        <p className="text-sm text-gray-500 mt-1">Connect accounts to enable autonomous publishing across 14 platforms.</p>
      </div>

      {/* Connected accounts */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          Connected accounts
          {accounts.length > 0 && (
            <span className="ml-2 text-xs font-normal text-gray-400">{accounts.length} connected</span>
          )}
        </h2>
        {isLoading ? (
          <div className="space-y-2 animate-pulse">
            {[...Array(2)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-2xl" />)}
          </div>
        ) : accounts.length === 0 ? (
          <div className="py-10 bg-white border border-dashed border-gray-200 rounded-2xl text-center">
            <Link2 className="w-7 h-7 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No accounts connected yet.</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100">
            {accounts.map((account) => {
              const meta = PLATFORM_META[account.platform] ?? {
                label: account.platform, textColor: "text-gray-700",
                bgColor: "bg-gray-100", dotColor: "bg-gray-400",
              };
              const expiring = isExpiringSoon(account.tokenExpiresAt);
              return (
                <div key={account.id} className="px-5 py-4 flex items-center gap-4">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${meta.bgColor}`}>
                    <div className={`w-2.5 h-2.5 rounded-full ${meta.dotColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold ${meta.textColor}`}>{meta.label}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${account.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {account.isActive ? "active" : "inactive"}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-900 truncate">@{account.accountHandle}</p>
                    {expiring && (
                      <div className="flex items-center gap-1 mt-0.5 text-xs text-amber-600">
                        <AlertTriangle className="w-3 h-3" />
                        Token expiring soon — reconnect to avoid interruptions
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => disconnect.mutate(account.id)}
                    disabled={disconnect.isPending}
                    className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50 transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Connect new platform */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Connect a platform</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {PLATFORM_ORDER.map((platform) => {
            const meta = PLATFORM_META[platform];
            if (!meta) return null;
            const isConnected = connectedPlatforms.has(platform);
            const isOAuth = meta.connectionType === "oauth";
            return (
              <button
                key={platform}
                onClick={() => !isConnected && handleConnect(platform)}
                disabled={isConnected || connecting === platform || connect.isPending}
                className={`flex items-center gap-3 p-4 rounded-2xl border text-left transition-all group ${
                  isConnected
                    ? "border-green-200 bg-green-50 cursor-default"
                    : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm cursor-pointer"
                }`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${meta.bgColor}`}>
                  <div className={`w-2.5 h-2.5 rounded-full ${meta.dotColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${meta.textColor}`}>{meta.label}</p>
                  <p className="text-xs text-gray-400 truncate">{meta.description}</p>
                </div>
                <div className="shrink-0 ml-1">
                  {isConnected ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : connecting === platform ? (
                    <ExternalLink className="w-3.5 h-3.5 text-gray-400 animate-pulse" />
                  ) : isOAuth ? (
                    <ExternalLink className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 transition-colors" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded border border-gray-300 group-hover:border-gray-500 transition-colors" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <p className="text-xs text-gray-400 mt-3">
          <ExternalLink className="w-3 h-3 inline mr-1" />
          OAuth platforms open in a new tab. Bot/token platforms use a setup modal.
        </p>
      </div>

      <div className="flex items-start gap-2.5 p-4 bg-gray-50 rounded-2xl border border-gray-200">
        <Shield className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
        <p className="text-xs text-gray-500 leading-relaxed">
          All tokens are encrypted at rest using AES-256-GCM and automatically refreshed before expiry. Your credentials are never logged or stored in plaintext.
        </p>
      </div>

      {/* Modals */}
      {openModal === "telegram" && <TelegramConnectModal onClose={() => setOpenModal(null)} />}
      {openModal === "discord" && <DiscordConnectModal onClose={() => setOpenModal(null)} />}
      {openModal === "slack" && <SlackConnectModal onClose={() => setOpenModal(null)} />}
      {openModal === "whatsapp" && <WhatsAppConnectModal onClose={() => setOpenModal(null)} />}
      {openModal === "bluesky" && <BlueskyConnectModal onClose={() => setOpenModal(null)} />}
      {openModal === "mastodon" && <MastodonConnectModal onClose={() => setOpenModal(null)} />}
    </div>
  );
}
