"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Link from "next/link";
import { ArrowLeft, BarChart3, CheckCircle2, XCircle, AlertCircle, Plus, FileText } from "lucide-react";

interface CampaignAnalytics {
  campaign: { id: string; name: string; goals: string[]; budgetCapCents: number | null };
  plans: Array<{ id: string; name: string }>;
  totals: {
    posts: number;
    published: number;
    failed: number;
    vetoed: number;
    totalLikes: number;
    totalReposts: number;
    totalComments: number;
    totalImpressions: number;
    avgEngagementRate: number;
  };
  byPlatform: Record<string, { published: number; likes: number; impressions: number; engagementRate: number }>;
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5">
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, isError } = useQuery<CampaignAnalytics>({
    queryKey: ["campaign-analytics", id],
    queryFn: () => api.get<CampaignAnalytics>(`/campaigns/${id}/analytics`),
  });

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-gray-100 rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="text-center py-24">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="text-gray-600">Failed to load campaign analytics.</p>
        <Link href="/dashboard/campaigns" className="mt-4 inline-flex items-center gap-1 text-sm text-green-600 hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to campaigns
        </Link>
      </div>
    );
  }

  const { campaign, plans, totals, byPlatform } = data;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/campaigns" className="p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{campaign.name}</h1>
          {campaign.goals.length > 0 && (
            <p className="text-sm text-gray-400 mt-0.5">{campaign.goals.join(" · ")}</p>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Posts Published" value={totals.published} />
        <StatCard label="Total Impressions" value={totals.totalImpressions.toLocaleString()} />
        <StatCard label="Total Likes" value={totals.totalLikes.toLocaleString()} />
        <StatCard
          label="Avg Engagement Rate"
          value={`${(totals.avgEngagementRate * 100).toFixed(2)}%`}
        />
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <p className="text-xs font-medium text-gray-500 mb-1">Outcome</p>
          <div className="flex items-center gap-4 mt-1">
            <span className="flex items-center gap-1 text-sm text-green-600 font-medium">
              <CheckCircle2 className="w-4 h-4" /> {totals.published}
            </span>
            <span className="flex items-center gap-1 text-sm text-red-500 font-medium">
              <XCircle className="w-4 h-4" /> {totals.vetoed} vetoed
            </span>
          </div>
        </div>
        {campaign.budgetCapCents && (
          <StatCard
            label="Budget Cap"
            value={`$${(campaign.budgetCapCents / 100).toLocaleString()}`}
          />
        )}
      </div>

      {/* By platform */}
      {Object.keys(byPlatform).length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-green-600" /> Performance by platform
          </h2>
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100">
            {Object.entries(byPlatform).map(([platform, stats]) => (
              <div key={platform} className="px-5 py-4 flex items-center justify-between">
                <span className="capitalize text-sm font-medium text-gray-800">{platform}</span>
                <div className="flex items-center gap-6 text-sm text-gray-500">
                  <span>{stats.published} posts</span>
                  <span>{stats.impressions.toLocaleString()} imp.</span>
                  <span>{stats.likes.toLocaleString()} likes</span>
                  <span className="font-medium text-gray-800">{(stats.engagementRate * 100).toFixed(2)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plans */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-green-600" /> Plans in this campaign
          </h2>
          <Link
            href={`/dashboard/plans?campaignId=${campaign.id}`}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-semibold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> New plan
          </Link>
        </div>
        {plans.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
            <p className="text-sm text-gray-500">No plans assigned to this campaign yet.</p>
            <Link
              href={`/dashboard/plans?campaignId=${campaign.id}`}
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-green-600 hover:underline"
            >
              <Plus className="w-3 h-3" /> Generate the first plan
            </Link>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100">
            {plans.map((plan) => (
              <Link
                key={plan.id}
                href={`/dashboard/plans/${plan.id}`}
                className="px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm font-medium text-gray-800">{plan.name}</span>
                <ArrowLeft className="w-4 h-4 text-gray-300 rotate-180" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
