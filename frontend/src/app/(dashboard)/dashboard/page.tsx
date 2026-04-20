"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Link from "next/link";
import {
  FileText, Clock, Globe, TrendingUp, ArrowRight,
  CheckCircle2, AlertTriangle, Sparkles, Building2,
  Bot, BarChart3,
} from "lucide-react";

interface OverviewData {
  totalPublished: number;
  byPlatform: Record<string, { posts: number; avgRate: number }>;
  recentPosts: Array<{ id: string; contentText: string; platform: string; publishedAt: string; brandName?: string }>;
}

interface Brand { id: string; name: string; }
interface Agent { id: string; name: string; }

export default function DashboardPage() {
  const { data, isLoading } = useQuery<OverviewData>({
    queryKey: ["analytics"],
    queryFn: () => api.get<OverviewData>("/analytics"),
  });

  const { data: pending } = useQuery<unknown[]>({
    queryKey: ["posts-review"],
    queryFn: () => api.get<unknown[]>("/posts/review"),
  });

  const { data: brands = [] } = useQuery<Brand[]>({
    queryKey: ["brands"],
    queryFn: () => api.get<Brand[]>("/brands"),
  });

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["agents"],
    queryFn: () => api.get<Agent[]>("/agents"),
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded-lg w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-gray-200 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const avgEngagement = (() => {
    if (!data?.byPlatform) return "0%";
    const rates = Object.values(data.byPlatform).map((p) => p.avgRate);
    if (!rates.length) return "0%";
    return ((rates.reduce((a, b) => a + b, 0) / rates.length) * 100).toFixed(2) + "%";
  })();

  const hasActivity = (data?.totalPublished ?? 0) > 0 || (pending?.length ?? 0) > 0;
  const hasBrands = brands.length > 0;
  const hasAgents = agents.length > 0;

  const STATS = [
    {
      icon: FileText,
      label: "Posts published",
      value: String(data?.totalPublished ?? 0),
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
    },
    {
      icon: Clock,
      label: "Pending review",
      value: String(pending?.length ?? 0),
      iconBg: pending?.length ? "bg-amber-50" : "bg-gray-50",
      iconColor: pending?.length ? "text-amber-600" : "text-gray-400",
      highlight: !!pending?.length,
    },
    {
      icon: Globe,
      label: "Platforms active",
      value: String(Object.keys(data?.byPlatform ?? {}).length),
      iconBg: "bg-purple-50",
      iconColor: "text-purple-600",
    },
    {
      icon: TrendingUp,
      label: "Avg engagement",
      value: avgEngagement,
      iconBg: "bg-green-50",
      iconColor: "text-green-600",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
          <p className="text-sm text-gray-500 mt-1">Last 30 days across all brands and platforms.</p>
        </div>
        {hasBrands && hasAgents && (
          <Link
            href="/dashboard/plans"
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Sparkles className="w-4 h-4" /> Generate plan
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {STATS.map(({ icon: Icon, label, value, iconBg, iconColor, highlight }) => (
          <div
            key={label}
            className={`p-5 rounded-2xl border flex flex-col gap-3 ${
              highlight ? "bg-amber-50 border-amber-200" : "bg-white border-gray-200"
            }`}
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconBg}`}>
              <Icon className={`w-4.5 h-4.5 ${iconColor}`} style={{ width: 18, height: 18 }} />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">{label}</p>
              <p className={`text-2xl font-bold ${highlight ? "text-amber-700" : "text-gray-900"}`}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Review queue CTA */}
      {!!pending?.length && (
        <div className="p-5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800 text-sm">
                {pending.length} post{pending.length !== 1 ? "s" : ""} awaiting review
              </p>
              <p className="text-amber-600 text-xs mt-0.5">Approve or veto before they go live.</p>
            </div>
          </div>
          <Link
            href="/dashboard/review"
            className="shrink-0 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-xl transition-colors flex items-center gap-1.5"
          >
            Review now <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Setup guide — shown until user has activity */}
      {!hasActivity && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Get started</h2>
            <p className="text-xs text-gray-400 mt-0.5">Complete these steps to generate your first content plan.</p>
          </div>
          <div className="divide-y divide-gray-100">
            <SetupStep
              number={1}
              done={hasBrands}
              title="Create a brand"
              description="Add your brand name and industry so the AI can learn your voice."
              href="/dashboard/brands"
              cta="Create brand"
              icon={Building2}
            />
            <SetupStep
              number={2}
              done={hasBrands}
              title="Ingest brand documents"
              description="Upload your brand guidelines, website copy, or any documents for deeper AI context."
              href="/dashboard/brands"
              cta="Go to Brands"
              icon={FileText}
              disabled={!hasBrands}
            />
            <SetupStep
              number={3}
              done={hasAgents}
              title="Configure an agent"
              description="Set up an AI agent with tone instructions for your brand."
              href="/dashboard/agents"
              cta="Create agent"
              icon={Bot}
              disabled={!hasBrands}
            />
            <SetupStep
              number={4}
              done={false}
              title="Generate your first plan"
              description="Choose platforms and goals — the AI will create a full 30-day content calendar."
              href="/dashboard/plans"
              cta="Generate plan"
              icon={Sparkles}
              disabled={!hasBrands || !hasAgents}
            />
          </div>
        </div>
      )}

      {/* Quick actions */}
      {hasActivity && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Manage brands", href: "/dashboard/brands", icon: Building2, color: "text-green-600", bg: "bg-green-50" },
            { label: "Run agents", href: "/dashboard/agents", icon: Bot, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "New plan", href: "/dashboard/plans", icon: Sparkles, color: "text-purple-600", bg: "bg-purple-50" },
            { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3, color: "text-amber-600", bg: "bg-amber-50" },
          ].map(({ label, href, icon: Icon, color, bg }) => (
            <Link
              key={label}
              href={href}
              className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-2xl hover:border-gray-300 hover:shadow-sm transition-all group"
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${bg} shrink-0`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">{label}</span>
            </Link>
          ))}
        </div>
      )}

      {/* Platform breakdown */}
      {data?.byPlatform && Object.keys(data.byPlatform).length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-4">By platform</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(data.byPlatform).map(([platform, stats]) => (
              <div key={platform} className="p-4 bg-white border border-gray-200 rounded-2xl">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-700 capitalize">{platform}</p>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    {(stats.avgRate * 100).toFixed(2)}%
                  </span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{stats.posts}</p>
                <p className="text-xs text-gray-400 mt-0.5">posts published</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent posts */}
      {data?.recentPosts && data.recentPosts.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">Recent posts</h2>
            <Link href="/dashboard/analytics" className="text-xs text-green-600 hover:text-green-700 font-medium">
              View analytics →
            </Link>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100">
            {data.recentPosts.map((post) => (
              <div key={post.id} className="px-5 py-4 flex items-center gap-4">
                <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full capitalize shrink-0">
                  {post.platform}
                </span>
                <p className="text-sm text-gray-700 flex-1 truncate">{post.contentText}</p>
                <div className="flex items-center gap-1.5 shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                  <span className="text-xs text-gray-400">
                    {new Date(post.publishedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SetupStep({
  number, done, title, description, href, cta, icon: Icon, disabled = false,
}: {
  number: number;
  done: boolean;
  title: string;
  description: string;
  href: string;
  cta: string;
  icon: React.ElementType;
  disabled?: boolean;
}) {
  return (
    <div className={`flex items-start gap-4 px-6 py-4 ${disabled ? "opacity-50" : ""}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold ${
        done ? "bg-green-600 text-white" : "bg-gray-100 text-gray-500"
      }`}>
        {done ? <CheckCircle2 className="w-4 h-4" /> : number}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <Icon className="w-4 h-4 text-gray-400 shrink-0" />
          <p className={`text-sm font-medium ${done ? "line-through text-gray-400" : "text-gray-900"}`}>{title}</p>
        </div>
        <p className="text-xs text-gray-400">{description}</p>
      </div>
      {!done && !disabled && (
        <Link
          href={href}
          className="shrink-0 text-xs font-medium text-green-600 hover:text-green-700 flex items-center gap-1 whitespace-nowrap"
        >
          {cta} <ArrowRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  );
}
