"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Link from "next/link";
import {
  TrendingUp, Plus, Trash2, RefreshCw, Globe, Target,
  BarChart2, Zap, Share2, MessageCircle, Award, AlertCircle,
  ChevronDown, ChevronUp, ExternalLink, Loader2, Search, Pencil, X,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Competitor {
  id: string;
  name: string;
  websiteUrl: string | null;
  socialHandles: Record<string, string> | null;
  tier: "direct" | "indirect" | "aspirational";
  status: "active" | "inactive" | "new";
  notes: string | null;
  createdAt: string;
}

interface IndustryOverview {
  summary: string;
  marketSize: string;
  growthRate: string;
  keyTrends: string[];
  majorPlayers: string[];
}

interface ContentAnalysis {
  postingCadence: Record<string, string>;
  topThemes: Record<string, string[]>;
  formatMix: Record<string, { video: number; image: number; text: number; carousel: number }>;
  toneProfiles: Record<string, string>;
}

interface EngagementBenchmarks {
  avgLikes: Record<string, number>;
  avgComments: Record<string, number>;
  avgShares: Record<string, number>;
  engagementRates: Record<string, string>;
  followerGrowthTrend: Record<string, string>;
  viralityScore: Record<string, string>;
}

interface GapAnalysis {
  uncoveredTopics: string[];
  postingTimeGaps: string[];
  hashtagOpportunities: string[];
  platformGaps: string[];
}

interface ShareOfVoice {
  breakdown: Record<string, number>;
  brandShare: number;
  trend: string;
}

interface SentimentAnalysis {
  scores: Record<string, { positive: number; neutral: number; negative: number }>;
  topPositiveDrivers: Record<string, string[]>;
  topNegativeDrivers: Record<string, string[]>;
}

interface BenchmarkMetric {
  metric: string;
  brandValue: string;
  competitorValues: Record<string, string>;
  status: "ahead" | "at_par" | "behind";
}

interface CompetitorAnalysis {
  id: string;
  generatedAt: string;
  industryOverview: IndustryOverview | null;
  contentAnalysis: ContentAnalysis | null;
  engagementBenchmarks: EngagementBenchmarks | null;
  gapAnalysis: GapAnalysis | null;
  shareOfVoice: ShareOfVoice | null;
  sentimentAnalysis: SentimentAnalysis | null;
  benchmarkScorecard: { metrics: BenchmarkMetric[] } | null;
}

interface IntelData {
  analysis: CompetitorAnalysis | null;
  competitors: Competitor[];
  suggestions: string[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const TIER_COLORS = {
  direct: "bg-red-50 text-red-700 border-red-200",
  indirect: "bg-amber-50 text-amber-700 border-amber-200",
  aspirational: "bg-purple-50 text-purple-700 border-purple-200",
} as const;

const STATUS_COLORS = {
  active: "bg-green-100 text-green-700",
  inactive: "bg-gray-100 text-gray-500",
  new: "bg-blue-100 text-blue-700",
} as const;

const STATUS_LABELS: Record<BenchmarkMetric["status"], { label: string; cls: string }> = {
  ahead: { label: "Ahead", cls: "bg-green-100 text-green-700" },
  at_par: { label: "At par", cls: "bg-gray-100 text-gray-600" },
  behind: { label: "Behind", cls: "bg-red-100 text-red-700" },
};

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-purple-600">{icon}</span>
          <span className="font-semibold text-gray-900 text-sm">{title}</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="px-5 pb-5 border-t border-gray-100">{children}</div>}
    </div>
  );
}

function SentimentBar({ positive, neutral, negative }: { positive: number; neutral: number; negative: number }) {
  return (
    <div className="flex h-2 rounded-full overflow-hidden w-full">
      <div className="bg-green-400" style={{ width: `${positive}%` }} title={`Positive ${positive}%`} />
      <div className="bg-gray-300" style={{ width: `${neutral}%` }} title={`Neutral ${neutral}%`} />
      <div className="bg-red-400" style={{ width: `${negative}%` }} title={`Negative ${negative}%`} />
    </div>
  );
}

function FormatDonut({ mix }: { mix: { video: number; image: number; text: number; carousel: number } }) {
  const items = [
    { label: "Video", value: mix.video, color: "bg-purple-400" },
    { label: "Image", value: mix.image, color: "bg-blue-400" },
    { label: "Text", value: mix.text, color: "bg-green-400" },
    { label: "Carousel", value: mix.carousel, color: "bg-amber-400" },
  ];
  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-1.5 text-xs text-gray-600">
          <div className={`w-2.5 h-2.5 rounded-sm ${it.color}`} />
          <span>{it.label} {it.value}%</span>
        </div>
      ))}
    </div>
  );
}

// ── Add / Edit Competitor Modal ────────────────────────────────────────────────

function CompetitorFormModal({
  brandId,
  existing,
  prefillName,
  onClose,
  onSaved,
}: {
  brandId: string;
  existing?: Competitor;
  prefillName?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!existing;
  const [form, setForm] = useState({
    name: existing?.name ?? prefillName ?? "",
    websiteUrl: existing?.websiteUrl ?? "",
    tier: (existing?.tier ?? "direct") as Competitor["tier"],
    twitterHandle: existing?.socialHandles?.["twitter"] ?? "",
    instagramHandle: existing?.socialHandles?.["instagram"] ?? "",
    linkedinHandle: existing?.socialHandles?.["linkedin"] ?? "",
    tiktokHandle: existing?.socialHandles?.["tiktok"] ?? "",
    notes: existing?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [looking, setLooking] = useState(false);
  const [lookupNote, setLookupNote] = useState("");
  const [error, setError] = useState("");

  async function handleLookup() {
    if (!form.name.trim()) { setError("Enter a brand name first"); return; }
    setLooking(true);
    setError("");
    setLookupNote("");
    try {
      const result = await api.post<{
        websiteUrl: string | null;
        socialHandles: Record<string, string>;
        description: string;
        industry: string | null;
      }>(`/brands/${brandId}/competitors/lookup`, {
        name: form.name.trim(),
        websiteUrl: form.websiteUrl || undefined,
      });

      setForm((f) => ({
        ...f,
        websiteUrl: result.websiteUrl ?? f.websiteUrl,
        twitterHandle: result.socialHandles["twitter"] ?? f.twitterHandle,
        instagramHandle: result.socialHandles["instagram"] ?? f.instagramHandle,
        linkedinHandle: result.socialHandles["linkedin"] ?? f.linkedinHandle,
        tiktokHandle: result.socialHandles["tiktok"] ?? f.tiktokHandle,
        notes: f.notes || result.description || f.notes,
      }));
      setLookupNote(result.description ? `Found: ${result.description}` : "Fields pre-filled — review before saving.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setLooking(false);
    }
  }

  async function handleSave() {
    if (!form.name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    setError("");
    try {
      const socialHandles: Record<string, string> = {};
      if (form.twitterHandle) socialHandles["twitter"] = form.twitterHandle;
      if (form.instagramHandle) socialHandles["instagram"] = form.instagramHandle;
      if (form.linkedinHandle) socialHandles["linkedin"] = form.linkedinHandle;
      if (form.tiktokHandle) socialHandles["tiktok"] = form.tiktokHandle;

      const payload = {
        name: form.name.trim(),
        websiteUrl: form.websiteUrl || null,
        tier: form.tier,
        socialHandles: Object.keys(socialHandles).length > 0 ? socialHandles : null,
        notes: form.notes || null,
      };

      if (isEdit) {
        await api.patch(`/brands/${brandId}/competitors/${existing.id}`, payload);
      } else {
        await api.post(`/brands/${brandId}/competitors`, payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">{isEdit ? "Edit competitor" : "Add competitor"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="p-6 space-y-4">
          {error && <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg">{error}</p>}
          {lookupNote && <p className="text-xs text-green-700 bg-green-50 p-2.5 rounded-lg">{lookupNote}</p>}

          {/* Name + lookup */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Brand name *</label>
            <div className="flex gap-2">
              <input
                value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Competitor Co."
                className="flex-1 px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                onClick={handleLookup}
                disabled={looking || !form.name.trim()}
                title="Pre-analyse: auto-fill website & social handles"
                className="flex items-center gap-1.5 px-3 py-2.5 border border-purple-200 bg-purple-50 text-purple-700 rounded-xl text-xs font-medium hover:bg-purple-100 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {looking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                {looking ? "Looking up…" : "Pre-analyse"}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">Click Pre-analyse to auto-fill website & social handles</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Website URL</label>
            <input
              value={form.websiteUrl} onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })}
              placeholder="https://competitor.com"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Tier</label>
            <select
              value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value as Competitor["tier"] })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
            >
              <option value="direct">Direct</option>
              <option value="indirect">Indirect</option>
              <option value="aspirational">Aspirational</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {(["twitter", "instagram", "linkedin", "tiktok"] as const).map((platform) => (
              <div key={platform}>
                <label className="block text-xs font-medium text-gray-600 mb-1.5 capitalize">{platform}</label>
                <input
                  value={form[`${platform}Handle` as keyof typeof form] as string}
                  onChange={(e) => setForm({ ...form, [`${platform}Handle`]: e.target.value })}
                  placeholder="@handle"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Notes</label>
            <textarea
              value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>
        <div className="px-6 pb-5 flex gap-3">
          <button
            onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            {saving ? "Saving…" : isEdit ? "Save changes" : "Add competitor"}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Competitor Detail Modal ────────────────────────────────────────────────────

function CompetitorDetailModal({
  competitor,
  brandId,
  onClose,
  onEdited,
  onDeleted,
}: {
  competitor: Competitor;
  brandId: string;
  onClose: () => void;
  onEdited: () => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`Remove ${competitor.name} from your competitors?`)) return;
    setDeleting(true);
    try {
      await api.delete(`/brands/${brandId}/competitors/${competitor.id}`);
      onDeleted();
      onClose();
    } finally {
      setDeleting(false);
    }
  }

  if (editing) {
    return (
      <CompetitorFormModal
        brandId={brandId}
        existing={competitor}
        onClose={() => setEditing(false)}
        onSaved={() => { setEditing(false); onEdited(); }}
      />
    );
  }

  const handles = competitor.socialHandles ?? {};

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-semibold text-gray-900">{competitor.name}</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${TIER_COLORS[competitor.tier]}`}>
              {competitor.tier}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[competitor.status]}`}>
              {competitor.status}
            </span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none ml-2 shrink-0">×</button>
        </div>

        <div className="p-6 space-y-5">
          {competitor.websiteUrl && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Website</p>
              <a
                href={competitor.websiteUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-purple-600 hover:text-purple-700"
              >
                <Globe className="w-3.5 h-3.5" />
                {competitor.websiteUrl.replace(/^https?:\/\//, "")}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          {Object.keys(handles).length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Social handles</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(handles).map(([platform, handle]) => (
                  <span
                    key={platform}
                    className="text-xs px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full capitalize font-medium"
                  >
                    {platform}: {handle}
                  </span>
                ))}
              </div>
            </div>
          )}

          {competitor.notes && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Notes</p>
              <p className="text-sm text-gray-700 leading-relaxed">{competitor.notes}</p>
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Added</p>
            <p className="text-sm text-gray-600">
              {new Date(competitor.createdAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
            </p>
          </div>
        </div>

        <div className="px-6 pb-5 flex gap-3">
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 flex-1 justify-center py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit
          </button>
          <button
            onClick={handleDelete} disabled={deleting}
            className="flex items-center gap-1.5 px-4 py-2.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" /> {deleting ? "Removing…" : "Remove"}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function CompetitiveIntelligencePage() {
  const { id: brandId } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [trackSuggestion, setTrackSuggestion] = useState<string | null>(null);
  const [selectedCompetitor, setSelectedCompetitor] = useState<Competitor | null>(null);
  const [refreshError, setRefreshError] = useState("");

  const { data, isLoading } = useQuery<IntelData>({
    queryKey: ["competitive-intel", brandId],
    queryFn: () => api.get<IntelData>(`/brands/${brandId}/competitive-intelligence`),
  });

  const refresh = useMutation({
    mutationFn: () => api.post<CompetitorAnalysis>(`/brands/${brandId}/competitive-intelligence/refresh`, {}),
    onSuccess: () => {
      setRefreshError("");
      qc.invalidateQueries({ queryKey: ["competitive-intel", brandId] });
    },
    onError: (err) => setRefreshError(err instanceof Error ? err.message : "Analysis failed"),
  });

  const refreshSuggestions = useMutation({
    mutationFn: () => api.post<{ suggestions: string[] }>(`/brands/${brandId}/competitor-suggestions/refresh`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["competitive-intel", brandId] }),
  });

  async function dismissSuggestion(name: string) {
    await api.post(`/brands/${brandId}/competitor-suggestions/dismiss`, { name });
    qc.invalidateQueries({ queryKey: ["competitive-intel", brandId] });
  }

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ["competitive-intel", brandId] });
    qc.invalidateQueries({ queryKey: ["competitors", brandId] });
  }

  const competitors = data?.competitors ?? [];
  const analysis = data?.analysis ?? null;
  const suggestions = data?.suggestions ?? [];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <Link href={`/dashboard/brands/${brandId}`} className="text-sm text-gray-400 hover:text-gray-600">
          ← Brand profile
        </Link>
        <div className="flex items-start justify-between mt-2 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Competitive Intelligence</h1>
            {analysis && (
              <p className="text-xs text-gray-500 mt-1">
                Last updated: {new Date(analysis.generatedAt).toLocaleString()}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add competitor
            </button>
            <button
              onClick={() => { setRefreshError(""); refresh.mutate(); }}
              disabled={refresh.isPending || competitors.length === 0}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {refresh.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing…</>
                : <><RefreshCw className="w-4 h-4" /> {analysis ? "Refresh analysis" : "Run analysis"}</>
              }
            </button>
          </div>
        </div>
        {refreshError && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {refreshError}
          </div>
        )}
      </div>

      {/* Suggested Competitors */}
      {suggestions.length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-purple-900">Suggested competitors</h2>
              <p className="text-xs text-purple-600 mt-0.5">AI-discovered based on your brand's industry and positioning</p>
            </div>
            <button
              onClick={() => refreshSuggestions.mutate()}
              disabled={refreshSuggestions.isPending}
              className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-medium disabled:opacity-50"
            >
              {refreshSuggestions.isPending
                ? <><Loader2 className="w-3 h-3 animate-spin" /> Refreshing…</>
                : <><RefreshCw className="w-3 h-3" /> Refresh</>}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((name) => (
              <div key={name} className="flex items-center gap-1 bg-white border border-purple-200 rounded-full pl-3 pr-1 py-1">
                <span className="text-xs font-medium text-gray-800">{name}</span>
                <button
                  onClick={() => setTrackSuggestion(name)}
                  className="ml-1 text-xs px-2 py-0.5 bg-purple-600 hover:bg-purple-700 text-white rounded-full transition-colors"
                >
                  Track
                </button>
                <button
                  onClick={() => dismissSuggestion(name)}
                  className="p-0.5 text-purple-300 hover:text-purple-600 transition-colors"
                  title="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Competitor Tracking */}
      <SectionCard title="Competitor Tracking" icon={<Target className="w-5 h-5" />}>
        {isLoading ? (
          <div className="pt-4 space-y-2">
            {[...Array(2)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : competitors.length === 0 ? (
          <div className="pt-5 text-center py-8">
            <p className="text-sm text-gray-500 mb-3">No competitors added yet.</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="text-sm text-purple-600 hover:text-purple-700 font-medium underline"
            >
              Add your first competitor →
            </button>
          </div>
        ) : (
          <div className="pt-4 space-y-3">
            {competitors.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCompetitor(c)}
                className="w-full flex items-start justify-between gap-4 p-4 bg-gray-50 hover:bg-purple-50 rounded-xl border border-gray-100 hover:border-purple-200 transition-colors text-left group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900 group-hover:text-purple-800">{c.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${TIER_COLORS[c.tier]}`}>
                      {c.tier}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status]}`}>
                      {c.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-gray-500">
                    {c.websiteUrl && (
                      <span className="flex items-center gap-1">
                        <Globe className="w-3 h-3" /> {c.websiteUrl.replace(/^https?:\/\//, "")}
                      </span>
                    )}
                    {c.socialHandles && Object.entries(c.socialHandles).map(([platform, handle]) => (
                      <span key={platform} className="capitalize">{platform}: {handle}</span>
                    ))}
                  </div>
                  {c.notes && <p className="mt-1.5 text-xs text-gray-500 italic line-clamp-1">{c.notes}</p>}
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-gray-300 group-hover:text-purple-400 shrink-0 mt-0.5 transition-colors" />
              </button>
            ))}
          </div>
        )}
      </SectionCard>

      {!analysis && !isLoading && competitors.length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-6 text-center">
          <TrendingUp className="w-10 h-10 text-purple-400 mx-auto mb-3" />
          <p className="text-sm font-semibold text-purple-800 mb-1">Ready to analyze</p>
          <p className="text-xs text-purple-600 mb-4">
            You have {competitors.length} competitor{competitors.length !== 1 ? "s" : ""} added. Run analysis to unlock all insights.
          </p>
          <button
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
          >
            {refresh.isPending ? "Analyzing…" : "Run analysis now"}
          </button>
        </div>
      )}

      {/* Analysis sections — only shown when analysis exists */}
      {analysis && (
        <>
          {/* Industry Overview */}
          {analysis.industryOverview && (
            <SectionCard title="Industry Overview" icon={<Globe className="w-5 h-5" />}>
              <div className="pt-4 space-y-4">
                <p className="text-sm text-gray-700 leading-relaxed">{analysis.industryOverview.summary}</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs font-medium text-gray-500 mb-0.5">Market size</p>
                    <p className="text-sm font-semibold text-gray-900">{analysis.industryOverview.marketSize}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs font-medium text-gray-500 mb-0.5">Growth rate</p>
                    <p className="text-sm font-semibold text-gray-900">{analysis.industryOverview.growthRate}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Key trends</p>
                  <div className="flex flex-wrap gap-2">
                    {analysis.industryOverview.keyTrends.map((t) => (
                      <span key={t} className="text-xs px-2.5 py-1 bg-purple-50 text-purple-700 rounded-full border border-purple-100">{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            </SectionCard>
          )}

          {/* Content & Posting Analysis */}
          {analysis.contentAnalysis && (
            <SectionCard title="Content & Posting Analysis" icon={<BarChart2 className="w-5 h-5" />}>
              <div className="pt-4 space-y-5">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[500px]">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left text-xs font-medium text-gray-500 pb-2 pr-4">Competitor</th>
                        <th className="text-left text-xs font-medium text-gray-500 pb-2 pr-4">Cadence</th>
                        <th className="text-left text-xs font-medium text-gray-500 pb-2 pr-4">Tone</th>
                        <th className="text-left text-xs font-medium text-gray-500 pb-2">Format mix</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {Object.keys(analysis.contentAnalysis.postingCadence).map((comp) => (
                        <tr key={comp}>
                          <td className="py-3 pr-4 font-medium text-gray-900">{comp}</td>
                          <td className="py-3 pr-4 text-gray-600 text-xs">
                            {analysis.contentAnalysis!.postingCadence[comp]}
                          </td>
                          <td className="py-3 pr-4 text-gray-600 text-xs">
                            {analysis.contentAnalysis!.toneProfiles[comp] ?? "—"}
                          </td>
                          <td className="py-3">
                            {analysis.contentAnalysis!.formatMix[comp]
                              ? <FormatDonut mix={analysis.contentAnalysis!.formatMix[comp]!} />
                              : "—"
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Top themes */}
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-3">Content themes by competitor</p>
                  <div className="space-y-2">
                    {Object.entries(analysis.contentAnalysis.topThemes).map(([comp, themes]) => (
                      <div key={comp} className="flex items-start gap-3">
                        <span className="text-xs font-medium text-gray-700 w-28 shrink-0 pt-0.5">{comp}</span>
                        <div className="flex flex-wrap gap-1.5">
                          {themes.map((t) => (
                            <span key={t} className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">{t}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </SectionCard>
          )}

          {/* Engagement Benchmarks */}
          {analysis.engagementBenchmarks && (
            <SectionCard title="Engagement & Performance Benchmarks" icon={<Zap className="w-5 h-5" />}>
              <div className="pt-4 overflow-x-auto">
                <table className="w-full text-sm min-w-[600px]">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-medium text-gray-500 pb-2 pr-4">Competitor</th>
                      <th className="text-right text-xs font-medium text-gray-500 pb-2 pr-4">Avg Likes</th>
                      <th className="text-right text-xs font-medium text-gray-500 pb-2 pr-4">Avg Comments</th>
                      <th className="text-right text-xs font-medium text-gray-500 pb-2 pr-4">Avg Shares</th>
                      <th className="text-left text-xs font-medium text-gray-500 pb-2 pr-4">Eng. Rate</th>
                      <th className="text-left text-xs font-medium text-gray-500 pb-2">Growth</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {Object.keys(analysis.engagementBenchmarks.avgLikes).map((comp) => (
                      <tr key={comp}>
                        <td className="py-3 pr-4 font-medium text-gray-900">{comp}</td>
                        <td className="py-3 pr-4 text-right tabular-nums text-gray-700">
                          {(analysis.engagementBenchmarks!.avgLikes[comp] ?? 0).toLocaleString()}
                        </td>
                        <td className="py-3 pr-4 text-right tabular-nums text-gray-700">
                          {(analysis.engagementBenchmarks!.avgComments[comp] ?? 0).toLocaleString()}
                        </td>
                        <td className="py-3 pr-4 text-right tabular-nums text-gray-700">
                          {(analysis.engagementBenchmarks!.avgShares[comp] ?? 0).toLocaleString()}
                        </td>
                        <td className="py-3 pr-4 text-gray-700 font-medium">
                          {analysis.engagementBenchmarks!.engagementRates[comp] ?? "—"}
                        </td>
                        <td className="py-3 text-xs text-gray-600">
                          {analysis.engagementBenchmarks!.followerGrowthTrend[comp] ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          {/* Gap & Opportunity Analysis */}
          {analysis.gapAnalysis && (
            <SectionCard title="Gap & Opportunity Analysis" icon={<Target className="w-5 h-5" />}>
              <div className="pt-4 grid sm:grid-cols-2 gap-5">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Uncovered topics</p>
                  <ul className="space-y-1.5">
                    {analysis.gapAnalysis.uncoveredTopics.map((t) => (
                      <li key={t} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-green-500 mt-0.5">✦</span> {t}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Posting time gaps</p>
                  <ul className="space-y-1.5">
                    {analysis.gapAnalysis.postingTimeGaps.map((t) => (
                      <li key={t} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-blue-500 mt-0.5">◆</span> {t}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Hashtag opportunities</p>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.gapAnalysis.hashtagOpportunities.map((h) => (
                      <span key={h} className="text-xs px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full border border-amber-100 font-medium">{h}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Platform gaps</p>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.gapAnalysis.platformGaps.map((p) => (
                      <span key={p} className="text-xs px-2.5 py-1 bg-purple-50 text-purple-700 rounded-full border border-purple-100 font-medium">{p}</span>
                    ))}
                  </div>
                </div>
              </div>
            </SectionCard>
          )}

          {/* Share of Voice */}
          {analysis.shareOfVoice && (
            <SectionCard title="Share of Voice" icon={<Share2 className="w-5 h-5" />}>
              <div className="pt-4 space-y-4">
                <p className="text-sm text-gray-600">{analysis.shareOfVoice.trend}</p>
                <div className="space-y-2.5">
                  {Object.entries(analysis.shareOfVoice.breakdown)
                    .sort(([, a], [, b]) => b - a)
                    .map(([name, share]) => (
                      <div key={name}>
                        <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                          <span className="font-medium">{name}</span>
                          <span className="tabular-nums">{share}%</span>
                        </div>
                        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-purple-500 transition-all"
                            style={{ width: `${share}%` }}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </SectionCard>
          )}

          {/* Sentiment Analysis */}
          {analysis.sentimentAnalysis && (
            <SectionCard title="Sentiment Analysis" icon={<MessageCircle className="w-5 h-5" />}>
              <div className="pt-4 space-y-5">
                {Object.entries(analysis.sentimentAnalysis.scores).map(([comp, scores]) => (
                  <div key={comp}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-gray-900">{comp}</span>
                      <div className="flex gap-3 text-xs text-gray-500">
                        <span className="text-green-600">+{scores.positive}%</span>
                        <span className="text-gray-400">{scores.neutral}%</span>
                        <span className="text-red-500">-{scores.negative}%</span>
                      </div>
                    </div>
                    <SentimentBar {...scores} />
                    <div className="mt-2 grid sm:grid-cols-2 gap-2 text-xs text-gray-600">
                      {analysis.sentimentAnalysis!.topPositiveDrivers[comp] && (
                        <div>
                          <span className="font-medium text-green-600">Positive: </span>
                          {analysis.sentimentAnalysis!.topPositiveDrivers[comp]?.join(", ")}
                        </div>
                      )}
                      {analysis.sentimentAnalysis!.topNegativeDrivers[comp] && (
                        <div>
                          <span className="font-medium text-red-500">Negative: </span>
                          {analysis.sentimentAnalysis!.topNegativeDrivers[comp]?.join(", ")}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Benchmarking Dashboard */}
          {analysis.benchmarkScorecard && (
            <SectionCard title="Benchmarking Dashboard" icon={<Award className="w-5 h-5" />}>
              <div className="pt-4 overflow-x-auto">
                <table className="w-full text-sm min-w-[500px]">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-medium text-gray-500 pb-2 pr-4">Metric</th>
                      <th className="text-left text-xs font-medium text-gray-500 pb-2 pr-4">Your brand</th>
                      {competitors.slice(0, 3).map((c) => (
                        <th key={c.id} className="text-left text-xs font-medium text-gray-500 pb-2 pr-4 truncate max-w-[100px]">
                          {c.name}
                        </th>
                      ))}
                      <th className="text-left text-xs font-medium text-gray-500 pb-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {analysis.benchmarkScorecard.metrics.map((m) => {
                      const s = STATUS_LABELS[m.status];
                      return (
                        <tr key={m.metric}>
                          <td className="py-3 pr-4 text-gray-700 font-medium">{m.metric}</td>
                          <td className="py-3 pr-4 font-semibold text-gray-900">{m.brandValue}</td>
                          {competitors.slice(0, 3).map((c) => (
                            <td key={c.id} className="py-3 pr-4 text-gray-600">
                              {m.competitorValues[c.name] ?? "—"}
                            </td>
                          ))}
                          <td className="py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.cls}`}>{s.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}
        </>
      )}

      {showAddModal && (
        <CompetitorFormModal
          brandId={brandId}
          onClose={() => setShowAddModal(false)}
          onSaved={invalidateAll}
        />
      )}

      {trackSuggestion && (
        <CompetitorFormModal
          brandId={brandId}
          prefillName={trackSuggestion}
          onClose={() => setTrackSuggestion(null)}
          onSaved={async () => {
            await dismissSuggestion(trackSuggestion);
            setTrackSuggestion(null);
            invalidateAll();
          }}
        />
      )}

      {selectedCompetitor && (
        <CompetitorDetailModal
          competitor={selectedCompetitor}
          brandId={brandId}
          onClose={() => setSelectedCompetitor(null)}
          onEdited={() => { setSelectedCompetitor(null); invalidateAll(); }}
          onDeleted={() => { setSelectedCompetitor(null); invalidateAll(); }}
        />
      )}
    </div>
  );
}
