"use client";

import { useState, useEffect, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import {
  Link2, CheckCircle2, AlertTriangle, ExternalLink, Shield,
  ChevronDown, ChevronLeft, X, Loader2, Tag, Bot,
} from "lucide-react";
import { TelegramConnectModal } from "@/components/accounts/TelegramConnectModal";
import {
  DiscordConnectModal,
  SlackConnectModal,
  WhatsAppConnectModal,
  BlueskyConnectModal,
  MastodonConnectModal,
  PinterestConnectModal,
} from "@/components/accounts/TokenConnectModal";
import { EmailConnectModal } from "@/components/accounts/EmailConnectModal";

// ── Types ──────────────────────────────────────────────────────────────────────

interface AssignedAgent {
  id: string;
  name: string;
}

interface SocialAccount {
  id: string;
  platform: string;
  accountHandle: string;
  isActive: boolean;
  tokenExpiresAt: string | null;
  createdAt: string;
  brandProfileId: string | null;
  brandName: string | null;
  agents: AssignedAgent[];
  platformConfig?: Record<string, unknown>;
}

interface Brand {
  id: string;
  name: string;
}

interface Agent {
  id: string;
  name: string;
  brandProfileId: string;
  isActive: boolean;
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
  pinterest: { label: "Pinterest",    textColor: "text-red-700",    bgColor: "bg-rose-50",    dotColor: "bg-rose-500",   connectionType: "modal",  description: "Pin images and content to boards" },
  email:     { label: "Email",        textColor: "text-amber-700",  bgColor: "bg-amber-50",   dotColor: "bg-amber-500",  connectionType: "modal",  description: "Send campaigns via SendGrid or Mailgun" },
};

const PLATFORM_ORDER = [
  "x", "instagram", "linkedin", "facebook", "tiktok", "threads",
  "reddit", "youtube", "pinterest", "email", "telegram", "discord",
  "slack", "whatsapp", "bluesky", "mastodon",
];

type ModalPlatform = "telegram" | "discord" | "slack" | "whatsapp" | "bluesky" | "mastodon" | "pinterest" | "email" | null;

// ── Assign dropdown — brand then multi-select agents ──────────────────────────

function AssignDropdown({
  accountId,
  account,
  brands,
  agents,
  onClose,
}: {
  accountId: string;
  account: SocialAccount;
  brands: Brand[];
  agents: Agent[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [step, setStep] = useState<"brand" | "agents">("brand");
  const [pendingBrand, setPendingBrand] = useState<Brand | null>(null);
  const [selectedAgentIds, setSelectedAgentIds] = useState<Set<string>>(
    new Set(account.agents.map((a) => a.id)),
  );

  const assign = useMutation({
    mutationFn: (body: { brandId: string | null; agentIds: string[] }) =>
      api.put(`/accounts/${accountId}/assign`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      onClose();
    },
  });

  function handleBrandClick(brand: Brand) {
    const brandAgents = agents.filter((a) => a.brandProfileId === brand.id && a.isActive);
    if (brandAgents.length === 0) {
      assign.mutate({ brandId: brand.id, agentIds: [] });
    } else if (brandAgents.length === 1) {
      assign.mutate({ brandId: brand.id, agentIds: [brandAgents[0]!.id] });
    } else {
      // Carry over any already-selected agents from this brand
      const carried = new Set(
        account.brandProfileId === brand.id ? account.agents.map((a) => a.id) : [],
      );
      setSelectedAgentIds(carried);
      setPendingBrand(brand);
      setStep("agents");
    }
  }

  function toggleAgent(agentId: string) {
    setSelectedAgentIds((prev) => {
      const next = new Set(prev);
      next.has(agentId) ? next.delete(agentId) : next.add(agentId);
      return next;
    });
  }

  const PANEL = "w-60 bg-white border border-gray-200 rounded-xl shadow-xl py-1";

  if (step === "agents" && pendingBrand) {
    const brandAgents = agents.filter((a) => a.brandProfileId === pendingBrand.id && a.isActive);
    return (
      <div className={PANEL}>
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
          <button
            onClick={() => { setStep("brand"); setPendingBrand(null); }}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <p className="text-xs font-medium text-gray-700 truncate flex-1">{pendingBrand.name}</p>
          <p className="text-xs text-gray-400 shrink-0">select agents</p>
        </div>

        {brandAgents.map((agent) => {
          const checked = selectedAgentIds.has(agent.id);
          return (
            <button
              key={agent.id}
              onClick={() => toggleAgent(agent.id)}
              className="w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 text-gray-700 hover:bg-gray-50"
            >
              <div className={`w-3.5 h-3.5 shrink-0 rounded border flex items-center justify-center transition-colors ${
                checked ? "bg-purple-600 border-purple-600" : "border-gray-300"
              }`}>
                {checked && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
              </div>
              <Bot className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className="truncate">{agent.name}</span>
            </button>
          );
        })}

        <div className="px-3 pt-2 pb-1 border-t border-gray-100">
          <button
            onClick={() => assign.mutate({ brandId: pendingBrand.id, agentIds: [...selectedAgentIds] })}
            disabled={assign.isPending}
            className="w-full text-center text-xs font-medium px-3 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {assign.isPending
              ? <Loader2 className="w-3 h-3 animate-spin mx-auto" />
              : selectedAgentIds.size === 0
                ? "Save (no agents)"
                : `Save (${selectedAgentIds.size} agent${selectedAgentIds.size !== 1 ? "s" : ""})`
            }
          </button>
        </div>

        {assign.isError && (
          <p className="px-3 py-1.5 text-xs text-red-500 border-t border-gray-100">
            {assign.error instanceof Error ? assign.error.message : "Failed"}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={PANEL}>
      <p className="px-3 pt-2 pb-1 text-xs font-medium text-gray-400 uppercase tracking-wide">Assign to brand</p>
      {brands.length === 0 ? (
        <p className="px-3 py-2 text-xs text-gray-400">No brands yet</p>
      ) : (
        brands.map((b) => {
          const brandAgents = agents.filter((a) => a.brandProfileId === b.id && a.isActive);
          const isCurrent = account.brandProfileId === b.id;
          return (
            <button
              key={b.id}
              onClick={() => handleBrandClick(b)}
              disabled={assign.isPending}
              className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 ${
                isCurrent
                  ? "bg-green-50 text-green-700 font-medium"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              {isCurrent
                ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                : <div className="w-3.5 h-3.5 shrink-0" />}
              <span className="truncate flex-1">{b.name}</span>
              {brandAgents.length === 0 ? (
                <span className="text-xs text-amber-500 shrink-0">no agent</span>
              ) : brandAgents.length > 1 ? (
                <span className="text-xs text-gray-400 shrink-0">{brandAgents.length} agents</span>
              ) : null}
              {brandAgents.length > 1 && <ChevronLeft className="w-3 h-3 text-gray-400 shrink-0 rotate-180" />}
            </button>
          );
        })
      )}
      {account.brandProfileId && (
        <>
          <div className="my-1 border-t border-gray-100" />
          <button
            onClick={() => assign.mutate({ brandId: null, agentIds: [] })}
            disabled={assign.isPending}
            className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
          >
            Unassign
          </button>
        </>
      )}
      {assign.isPending && (
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-400">
          <Loader2 className="w-3 h-3 animate-spin" /> Saving…
        </div>
      )}
      {assign.isError && (
        <p className="px-3 py-1.5 text-xs text-red-500 border-t border-gray-100">
          {assign.error instanceof Error ? assign.error.message : "Failed"}
        </p>
      )}
    </div>
  );
}

// ── Connected account row ──────────────────────────────────────────────────────

function AccountRow({
  account,
  brands,
  agents,
  onDisconnect,
  onEditEmail,
  highlight,
  isFirst,
  isLast,
}: {
  account: SocialAccount;
  brands: Brand[];
  agents: Agent[];
  onDisconnect: () => void;
  onEditEmail?: () => void;
  highlight: boolean;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const meta = PLATFORM_META[account.platform] ?? {
    label: account.platform, textColor: "text-gray-700",
    bgColor: "bg-gray-100", dotColor: "bg-gray-400",
  };
  const expiring =
    account.tokenExpiresAt &&
    new Date(account.tokenExpiresAt).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;

  const isAssigned = !!account.brandProfileId;

  return (
    <div
      className={`px-5 py-4 flex items-center gap-4 transition-colors ${
        highlight ? "bg-green-50" : "bg-white"
      } ${isFirst ? "rounded-t-2xl" : ""} ${isLast ? "rounded-b-2xl" : ""}`}
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${meta.bgColor}`}>
        <div className={`w-2.5 h-2.5 rounded-full ${meta.dotColor}`} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-semibold ${meta.textColor}`}>{meta.label}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${account.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
            {account.isActive ? "active" : "inactive"}
          </span>
          {isAssigned ? (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full border border-purple-100">
              <Tag className="w-2.5 h-2.5" />
              {account.brandName}
              {account.agents.length > 0 && (
                <>
                  <span className="text-purple-400">·</span>
                  <Bot className="w-2.5 h-2.5" />
                  {account.agents.length === 1
                    ? account.agents[0]!.name
                    : `${account.agents.length} agents`}
                </>
              )}
            </span>
          ) : (
            <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full border border-amber-200">
              Unassigned
            </span>
          )}
        </div>
        <p className="text-sm font-medium text-gray-900 truncate mt-0.5">@{account.accountHandle}</p>
        {expiring && (
          <div className="flex items-center gap-1 mt-0.5 text-xs text-amber-600">
            <AlertTriangle className="w-3 h-3" />
            Token expiring soon — reconnect to avoid interruptions
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {account.platform === "email" && onEditEmail && (
          <button
            onClick={onEditEmail}
            className="text-xs text-amber-600 hover:text-amber-800 font-medium transition-colors"
          >
            Edit
          </button>
        )}

        {/* Assign button */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 font-medium transition-colors"
          >
            {isAssigned ? "Reassign" : "Assign"}
            <ChevronDown className={`w-3 h-3 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
          </button>
          {dropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
              <div className="absolute right-0 top-7 z-20">
                <AssignDropdown
                  accountId={account.id}
                  account={account}
                  brands={brands}
                  agents={agents}
                  onClose={() => setDropdownOpen(false)}
                />
              </div>
            </>
          )}
        </div>

        <button
          onClick={onDisconnect}
          className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
        >
          Disconnect
        </button>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

function AccountsPageContent() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const [connecting, setConnecting] = useState<string | null>(null);
  const [openModal, setOpenModal] = useState<ModalPlatform>(null);
  const [editingEmail, setEditingEmail] = useState<SocialAccount | null>(null);
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [justConnected, setJustConnected] = useState<string | null>(null);
  const [connectBanner, setConnectBanner] = useState<string | null>(null);

  const { data: accounts = [], isLoading } = useQuery<SocialAccount[]>({
    queryKey: ["accounts"],
    queryFn: () => api.get<SocialAccount[]>("/accounts"),
  });

  const { data: brands = [] } = useQuery<Brand[]>({
    queryKey: ["brands"],
    queryFn: () => api.get<Brand[]>("/brands"),
    select: (data) => data.map(({ id, name }: { id: string; name: string }) => ({ id, name })),
  });

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["agents"],
    queryFn: () => api.get<Agent[]>("/agents"),
    select: (data) => data.map(({ id, name, brandProfileId, isActive }: Agent) => ({ id, name, brandProfileId, isActive })),
  });

  const disconnect = useMutation({
    mutationFn: (id: string) => api.delete(`/accounts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });

  const connect = useMutation({
    mutationFn: (platform: string) =>
      api.get<{ authUrl: string }>(`/accounts/oauth/${platform}`),
    onSuccess: (data) => { window.location.href = data.authUrl; },
    onError: (err) => { alert(err instanceof Error ? err.message : "Failed to get OAuth URL"); },
    onSettled: () => setConnecting(null),
  });

  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    if (connected) {
      setJustConnected(connected);
      setConnectBanner(connected);
      const url = new URL(window.location.href);
      url.searchParams.delete("connected");
      window.history.replaceState({}, "", url.toString());
    }
    if (error) {
      const url = new URL(window.location.href);
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams]);

  const connectedPlatforms = new Set(accounts.map((a) => a.platform));

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

  const filteredAccounts = accounts.filter((a) => {
    if (brandFilter === "all") return true;
    if (brandFilter === "unassigned") return !a.brandProfileId;
    return a.brandProfileId === brandFilter;
  });

  const brandsWithAccounts = brands.filter((b) =>
    accounts.some((a) => a.brandProfileId === b.id),
  );
  const unassignedCount = accounts.filter((a) => !a.brandProfileId).length;

  function closeModal() {
    setOpenModal(null);
    qc.invalidateQueries({ queryKey: ["accounts"] });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Channels</h1>
        <p className="text-sm text-gray-500 mt-1">Connect and assign social accounts to brands for autonomous publishing across 16 platforms.</p>
      </div>

      {connectBanner && (
        <div className="flex items-start justify-between gap-3 p-4 bg-green-50 border border-green-200 rounded-2xl">
          <div>
            <p className="text-sm font-semibold text-green-800">
              {PLATFORM_META[connectBanner]?.label ?? connectBanner} connected successfully!
            </p>
            <p className="text-xs text-green-600 mt-0.5">
              Assign it to a brand below so the agent knows which voice to use.
            </p>
          </div>
          <button onClick={() => setConnectBanner(null)} className="text-green-400 hover:text-green-600 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Connected accounts */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-gray-700">
            Connected accounts
            {accounts.length > 0 && (
              <span className="ml-2 text-xs font-normal text-gray-400">{accounts.length} connected</span>
            )}
          </h2>

          {(brandsWithAccounts.length > 0 || unassignedCount > 0) && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setBrandFilter("all")}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  brandFilter === "all"
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                }`}
              >
                All
              </button>
              {brandsWithAccounts.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setBrandFilter(b.id)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    brandFilter === b.id
                      ? "bg-purple-600 text-white border-purple-600"
                      : "bg-white text-gray-600 border-gray-200 hover:border-purple-300"
                  }`}
                >
                  {b.name}
                </button>
              ))}
              {unassignedCount > 0 && (
                <button
                  onClick={() => setBrandFilter("unassigned")}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    brandFilter === "unassigned"
                      ? "bg-amber-500 text-white border-amber-500"
                      : "bg-white text-amber-600 border-amber-200 hover:border-amber-400"
                  }`}
                >
                  Unassigned ({unassignedCount})
                </button>
              )}
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2 animate-pulse">
            {[...Array(2)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-2xl" />)}
          </div>
        ) : accounts.length === 0 ? (
          <div className="py-10 bg-white border border-dashed border-gray-200 rounded-2xl text-center">
            <Link2 className="w-7 h-7 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No accounts connected yet.</p>
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="py-8 bg-white border border-dashed border-gray-200 rounded-2xl text-center">
            <p className="text-sm text-gray-400">No accounts match this filter.</p>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-2xl divide-y divide-gray-100">
            {filteredAccounts.map((account, i) => (
              <AccountRow
                key={account.id}
                account={account}
                brands={brands}
                agents={agents}
                highlight={justConnected === account.platform}
                isFirst={i === 0}
                isLast={i === filteredAccounts.length - 1}
                onDisconnect={() => disconnect.mutate(account.id)}
                onEditEmail={account.platform === "email" ? () => setEditingEmail(account) : undefined}
              />
            ))}
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

      {openModal === "telegram" && <TelegramConnectModal onClose={closeModal} />}
      {openModal === "discord" && <DiscordConnectModal onClose={closeModal} />}
      {openModal === "slack" && <SlackConnectModal onClose={closeModal} />}
      {openModal === "whatsapp" && <WhatsAppConnectModal onClose={closeModal} />}
      {openModal === "bluesky" && <BlueskyConnectModal onClose={closeModal} />}
      {openModal === "mastodon" && <MastodonConnectModal onClose={closeModal} />}
      {openModal === "pinterest" && <PinterestConnectModal onClose={closeModal} />}
      {openModal === "email" && <EmailConnectModal onClose={closeModal} />}
      {editingEmail && (
        <EmailConnectModal
          onClose={() => { setEditingEmail(null); qc.invalidateQueries({ queryKey: ["accounts"] }); }}
          existing={{
            id: editingEmail.id,
            accountHandle: editingEmail.accountHandle,
            platformConfig: (editingEmail.platformConfig ?? {}) as any,
          }}
        />
      )}
    </div>
  );
}

export default function AccountsPage() {
  return (
    <Suspense>
      <AccountsPageContent />
    </Suspense>
  );
}
