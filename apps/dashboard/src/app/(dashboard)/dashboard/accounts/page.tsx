"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Link2, CheckCircle2, AlertTriangle, ExternalLink, Shield } from "lucide-react";

interface SocialAccount {
  id: string;
  platform: string;
  accountHandle: string;
  isActive: boolean;
  tokenExpiresAt: string | null;
  createdAt: string;
}

const PLATFORM_META: Record<string, { label: string; textColor: string; bgColor: string; dotColor: string }> = {
  x:         { label: "X (Twitter)", textColor: "text-gray-900",  bgColor: "bg-gray-100",  dotColor: "bg-gray-700" },
  instagram: { label: "Instagram",   textColor: "text-pink-700",  bgColor: "bg-pink-50",   dotColor: "bg-pink-500" },
  linkedin:  { label: "LinkedIn",    textColor: "text-blue-700",  bgColor: "bg-blue-50",   dotColor: "bg-blue-600" },
  facebook:  { label: "Facebook",    textColor: "text-blue-600",  bgColor: "bg-blue-50",   dotColor: "bg-blue-500" },
  tiktok:    { label: "TikTok",      textColor: "text-gray-900",  bgColor: "bg-gray-100",  dotColor: "bg-gray-800" },
};

const PLATFORMS = ["x", "instagram", "linkedin", "facebook", "tiktok"];

export default function AccountsPage() {
  const qc = useQueryClient();
  const [connecting, setConnecting] = useState<string | null>(null);

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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Social Accounts</h1>
        <p className="text-sm text-gray-500 mt-1">Connect social accounts to enable autonomous publishing.</p>
      </div>

      {/* Connected accounts */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Connected accounts</h2>
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
              const meta = PLATFORM_META[account.platform] ?? { label: account.platform, textColor: "text-gray-700", bgColor: "bg-gray-100", dotColor: "bg-gray-400" };
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
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {PLATFORMS.map((platform) => {
            const meta = PLATFORM_META[platform]!;
            const isConnected = connectedPlatforms.has(platform);
            return (
              <button
                key={platform}
                onClick={() => { setConnecting(platform); connect.mutate(platform); }}
                disabled={isConnected || connecting === platform || connect.isPending}
                className={`flex items-center gap-3 p-4 rounded-2xl border text-sm font-medium transition-all ${
                  isConnected
                    ? "border-green-200 bg-green-50 text-gray-700 cursor-default"
                    : "border-gray-200 bg-white hover:border-green-300 hover:shadow-sm text-gray-700"
                }`}
              >
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${meta.dotColor}`} />
                <span className="flex-1 text-left">{meta.label}</span>
                {isConnected ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                ) : connecting === platform ? (
                  <ExternalLink className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-start gap-2.5 p-4 bg-gray-50 rounded-2xl border border-gray-200">
        <Shield className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
        <p className="text-xs text-gray-500 leading-relaxed">
          OAuth tokens are encrypted at rest using AES-256-GCM and automatically refreshed before expiry. Your credentials are never logged or stored in plaintext.
        </p>
      </div>
    </div>
  );
}
