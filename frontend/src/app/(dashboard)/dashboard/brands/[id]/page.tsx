"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Link from "next/link";
import {
  Pencil, Check, X, Trash2, TrendingUp, TrendingDown, Minus, Sparkles,
  Plus, Globe, Mail, BookOpen, Target, Megaphone, Shield, Languages,
  AlertCircle, Archive, ArchiveRestore, Copy, Loader2, RefreshCw,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

// ── Types ──────────────────────────────────────────────────────────────────────

interface QualityStats {
  score: number;
  approvalRate: number;
  totalVetoed: number;
  totalGenerated: number;
  trend: "improving" | "stable" | "declining" | "insufficient_data";
  trendDescription: string;
  topVetoReasons: { reason: string; count: number }[];
}

interface BrandContext {
  brandStatements?: string[];
  audienceNotes?: string[];
  productsServices?: string[];
  valueProposition?: string | null;
  targetMarket?: string | null;
  contentPillars?: string[];
  competitors?: string[];
}

interface BrandProfile {
  id: string;
  name: string;
  industry: string | null;
  tagline: string | null;
  logoUrl: string | null;
  brandEmojis: string[] | null;

  // Voice & tone
  voiceTraits: Record<string, boolean> | null;
  toneDescriptors: string[] | null;
  voiceExamples: string[] | null;

  // Visual identity
  primaryColors: string[] | null;
  secondaryColors: string[] | null;
  typography: { primary: string | null; secondary: string | null } | null;

  // Brand story
  missionStatement: string | null;
  visionStatement: string | null;
  coreValues: { label: string; description?: string }[] | null;
  originStory: string | null;
  brandStage: string | null;

  // Content strategy
  contentDos: string[] | null;
  contentDonts: string[] | null;
  bannedWords: string[] | null;
  postingLanguages: string[] | null;
  contentRatio: { educational?: number; promotional?: number; entertaining?: number; conversational?: number } | null;

  // Audience
  audiencePersonas: { name: string; ageRange?: string; jobTitle?: string; painPoints?: string[]; goals?: string[]; platforms?: string[] }[] | null;
  geographicFocus: string[] | null;

  // Social & contact
  socialHandles: Record<string, string> | null;
  websiteUrl: string | null;
  brandEmail: string | null;

  // Infra
  brandContext: BrandContext | null;
  ingestStatus: "idle" | "processing" | "done" | "failed" | null;
  archivedAt: string | null;
  createdAt: string;
}

// ── Health score ───────────────────────────────────────────────────────────────

function computeHealthScore(brand: BrandProfile): { score: number; missing: string[] } {
  const checks: [boolean, string][] = [
    [!!brand.industry, "Industry"],
    [!!brand.tagline, "Tagline / slogan"],
    [!!brand.missionStatement, "Mission statement"],
    [!!brand.visionStatement, "Vision statement"],
    [(brand.coreValues?.length ?? 0) > 0, "Core values"],
    [(brand.voiceTraits && Object.values(brand.voiceTraits).some(Boolean)) || false, "Voice traits"],
    [(brand.toneDescriptors?.length ?? 0) > 0, "Tone descriptors"],
    [(brand.voiceExamples?.length ?? 0) > 0, "Voice examples"],
    [(brand.primaryColors?.length ?? 0) > 0, "Brand colors"],
    [!!(brand.brandContext?.contentPillars?.length), "Content pillars"],
    [(brand.bannedWords?.length ?? 0) > 0 || (brand.contentDos?.length ?? 0) > 0, "Content guidelines"],
    [!!brand.websiteUrl, "Website URL"],
    [!!brand.logoUrl, "Logo"],
    [!!(brand.brandContext?.audienceNotes?.length) || (brand.audiencePersonas?.length ?? 0) > 0, "Audience info"],
  ];

  const passed = checks.filter(([ok]) => ok).length;
  const missing = checks.filter(([ok]) => !ok).map(([, label]) => label);
  const score = Math.round((passed / checks.length) * 100);
  return { score, missing };
}

function HealthScore({ brand }: { brand: BrandProfile }) {
  const { score, missing } = computeHealthScore(brand);
  const [expanded, setExpanded] = useState(false);
  const color = score >= 75 ? "text-green-600" : score >= 50 ? "text-amber-600" : "text-red-600";
  const bar = score >= 75 ? "bg-green-500" : score >= 50 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="p-5 bg-white border border-gray-200 rounded-2xl space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Brand health score</h2>
        <span className={`text-xl font-bold ${color}`}>{score}<span className="text-sm text-gray-400 font-normal">/100</span></span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${bar}`} style={{ width: `${score}%` }} />
      </div>
      {missing.length > 0 && (
        <div>
          <button
            onClick={() => setExpanded((s) => !s)}
            className="text-xs text-gray-500 hover:text-gray-800 underline"
          >
            {expanded ? "Hide" : `${missing.length} missing field${missing.length !== 1 ? "s" : ""}`}
          </button>
          {expanded && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {missing.map((m) => (
                <span key={m} className="text-xs px-2.5 py-1 bg-gray-100 text-gray-500 rounded-full border border-gray-200">{m}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Quality Improvement ────────────────────────────────────────────────────────

function QualityImprovement({ brandId }: { brandId: string }) {
  const { data, isLoading } = useQuery<QualityStats>({
    queryKey: ["quality-improvement", brandId],
    queryFn: () => api.get<QualityStats>(`/brands/${brandId}/quality-improvement`),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading || !data || data.totalGenerated === 0) return null;

  const trendIcon = data.trend === "improving"
    ? <TrendingUp className="w-4 h-4 text-green-500" />
    : data.trend === "declining"
    ? <TrendingDown className="w-4 h-4 text-red-500" />
    : <Minus className="w-4 h-4 text-gray-400" />;

  const scoreColor = data.score >= 75 ? "text-green-600" : data.score >= 50 ? "text-amber-600" : "text-red-600";
  const scoreBg = data.score >= 75 ? "bg-green-50 border-green-200" : data.score >= 50 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";

  return (
    <div className={`rounded-2xl border p-5 ${scoreBg}`}>
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-4 h-4 text-purple-500" />
        <span className="text-xs font-semibold text-gray-700">AI Quality Improvement</span>
        {trendIcon}
      </div>
      <div className="flex items-baseline gap-3 mb-2">
        <span className={`text-2xl font-bold ${scoreColor}`}>{data.score}</span>
        <span className="text-xs text-gray-500">/ 100 quality score</span>
        <span className="text-xs text-gray-500">
          {Math.round(data.approvalRate * 100)}% approval · {data.totalGenerated} posts
        </span>
      </div>
      <p className="text-xs text-gray-600 mb-2">{data.trendDescription}</p>
      {data.topVetoReasons.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1.5">Top veto reasons (learning signals):</p>
          <div className="flex flex-wrap gap-1.5">
            {data.topVetoReasons.map((r) => (
              <span key={r.reason} className="text-xs px-2 py-0.5 bg-white/70 text-gray-600 rounded-full border border-gray-200">
                {r.reason} ×{r.count}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Inline editable field ──────────────────────────────────────────────────────

function EditableTextField({
  label, value, placeholder, onSave, multiline = false,
}: {
  label: string;
  value: string | null;
  placeholder?: string;
  onSave: (v: string) => void;
  multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  function save() {
    onSave(draft.trim());
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="group flex items-start gap-2">
        <div className="flex-1">
          <p className="text-xs text-gray-400 mb-0.5">{label}</p>
          <p className="text-sm text-gray-700">{value || <span className="text-gray-400 italic">{placeholder ?? "Not set"}</span>}</p>
        </div>
        <button
          onClick={() => { setDraft(value ?? ""); setEditing(true); }}
          className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-600 rounded transition-all"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400">{label}</p>
      {multiline ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
          autoFocus
        />
      ) : (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
          className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          autoFocus
        />
      )}
      <div className="flex gap-2">
        <button onClick={save} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors">Save</button>
        <button onClick={() => setEditing(false)} className="px-3 py-1.5 border border-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
      </div>
    </div>
  );
}

// ── Tag list editor ────────────────────────────────────────────────────────────

function EditableTagList({
  label, values, onSave, placeholder = "Add item…", colorClass = "bg-gray-100 text-gray-600",
}: {
  label: string;
  values: string[];
  onSave: (v: string[]) => void;
  placeholder?: string;
  colorClass?: string;
}) {
  const [input, setInput] = useState("");

  function add() {
    const t = input.trim();
    if (t && !values.includes(t)) onSave([...values, t]);
    setInput("");
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span key={v} className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full ${colorClass}`}>
            {v}
            <button onClick={() => onSave(values.filter((x) => x !== v))} className="opacity-60 hover:opacity-100">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <button
          onClick={add}
          disabled={!input.trim()}
          className="px-3 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 rounded-xl text-xs font-medium text-gray-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Tone Preview ───────────────────────────────────────────────────────────────

function TonePreview({ brandId }: { brandId: string }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const res = await api.post<{ preview: string }>(`/brands/${brandId}/tone-preview`, {});
      setPreview(res.preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500 font-medium">Tone preview</p>
        <button
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-purple-600 border border-purple-200 bg-purple-50 hover:bg-purple-100 rounded-xl transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {loading ? "Generating…" : preview ? "Regenerate" : "Generate sample"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {preview && (
        <div className="p-3.5 bg-purple-50 border border-purple-100 rounded-xl">
          <p className="text-sm text-gray-800 leading-relaxed italic">"{preview}"</p>
          <p className="text-xs text-purple-500 mt-1.5">AI-generated sample based on current voice configuration</p>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function BrandDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: brand, isLoading } = useQuery<BrandProfile>({
    queryKey: ["brand", id],
    queryFn: () => api.get<BrandProfile>(`/brands/${id}`),
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.ingestStatus === "processing" ? 3000 : false;
    },
  });

  const { data: competitorsList } = useQuery<{ id: string; name: string; tier: string }[]>({
    queryKey: ["competitors", id],
    queryFn: () => api.get(`/brands/${id}/competitors`),
    enabled: !!id,
  });

  const update = useMutation({
    mutationFn: (body: Partial<BrandProfile>) => api.put(`/brands/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brand", id] });
      qc.invalidateQueries({ queryKey: ["brands"] });
    },
  });

  const archive = useMutation({
    mutationFn: () => api.post(`/brands/${id}/archive`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["brand", id] }); qc.invalidateQueries({ queryKey: ["brands"] }); },
  });

  const unarchive = useMutation({
    mutationFn: () => api.post(`/brands/${id}/unarchive`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["brand", id] }); qc.invalidateQueries({ queryKey: ["brands"] }); },
  });

  const duplicate = useMutation({
    mutationFn: () => api.post<BrandProfile>(`/brands/${id}/duplicate`, {}),
    onSuccess: (clone) => { qc.invalidateQueries({ queryKey: ["brands"] }); router.push(`/dashboard/brands/${clone.id}`); },
  });

  const deleteBrand = useMutation({
    mutationFn: () => api.delete(`/brands/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["brands"] }); router.push("/dashboard/brands"); },
  });

  if (isLoading) return <div className="text-sm text-gray-500 animate-pulse">Loading brand…</div>;
  if (!brand) return <div className="text-sm text-gray-500">Brand not found.</div>;

  const activeVoiceTraits = brand.voiceTraits
    ? Object.entries(brand.voiceTraits).filter(([, v]) => v).map(([t]) => t)
    : [];

  function patch(body: Partial<BrandProfile>) {
    update.mutate(body);
  }

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Back */}
      <div>
        <Link href="/dashboard/brands" className="text-sm text-gray-400 hover:text-gray-600">← Brands</Link>
      </div>

      {/* Header card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            {brand.logoUrl ? (
              <img src={brand.logoUrl} alt={brand.name} className="w-12 h-12 rounded-xl object-cover border border-gray-100 shrink-0" />
            ) : (
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0"
                style={{ backgroundColor: brand.primaryColors?.[0] ?? "#6b7280" }}
              >
                {brand.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 truncate">{brand.name}</h1>
              {brand.tagline && <p className="text-sm text-gray-500 italic mt-0.5 truncate">{brand.tagline}</p>}
              {brand.industry && <p className="text-xs text-gray-400 mt-0.5">{brand.industry}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <Link
              href={`/dashboard/brands/${id}/competitive`}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 text-white text-xs font-medium rounded-xl hover:bg-purple-700 transition-colors"
            >
              <TrendingUp className="w-3.5 h-3.5" /> Intel
            </Link>
            <Link
              href={`/dashboard/brands/${id}/ingest`}
              className="px-3.5 py-2 bg-green-600 text-white text-xs font-medium rounded-xl hover:bg-green-700 transition-colors"
            >
              Ingest doc
            </Link>
            <button
              onClick={() => duplicate.mutate()}
              disabled={duplicate.isPending}
              title="Duplicate brand"
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50"
            >
              {duplicate.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
            </button>
            {brand.archivedAt ? (
              <button
                onClick={() => unarchive.mutate()}
                title="Restore brand"
                className="p-2 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-xl transition-colors"
              >
                <ArchiveRestore className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => archive.mutate()}
                title="Archive brand"
                className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-colors"
              >
                <Archive className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setConfirmDelete(true)}
              title="Delete brand"
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {brand.archivedAt && (
          <div className="mt-3 flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl">
            <Archive className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="text-xs text-amber-700">This brand is archived. Restore it to resume content generation.</span>
          </div>
        )}
      </div>

      {/* Health score */}
      <HealthScore brand={brand} />

      {/* Ingestion status */}
      {brand.ingestStatus === "processing" && (
        <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-2xl">
          <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-800">Processing document…</p>
            <p className="text-xs text-blue-600 mt-0.5">Extracting brand identity. Takes 10–30 seconds.</p>
          </div>
        </div>
      )}
      {brand.ingestStatus === "failed" && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-800">Ingestion failed</p>
            <p className="text-xs text-red-600 mt-0.5">
              <Link href={`/dashboard/brands/${id}/ingest`} className="underline">Try again →</Link>
            </p>
          </div>
        </div>
      )}

      {/* Brand Identity */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-5">
        <h2 className="text-sm font-semibold text-gray-900">Brand identity</h2>
        <EditableTextField label="Name" value={brand.name} onSave={(v) => v && patch({ name: v } as never)} />
        <EditableTextField label="Industry" value={brand.industry} placeholder="e.g. SaaS, E-commerce" onSave={(v) => patch({ industry: v || null } as never)} />
        <EditableTextField label="Tagline / slogan" value={brand.tagline} placeholder="Short phrase used across content" onSave={(v) => patch({ tagline: v || null } as never)} />
        <EditableTextField label="Website URL" value={brand.websiteUrl} placeholder="https://yoursite.com" onSave={(v) => patch({ websiteUrl: v || null } as never)} />
        <EditableTextField label="Brand email" value={brand.brandEmail} placeholder="hello@yoursite.com" onSave={(v) => patch({ brandEmail: v || null } as never)} />

        {/* Color palette */}
        {(brand.primaryColors?.length ?? 0) > 0 && (
          <div>
            <p className="text-xs text-gray-400 mb-2">Brand colors</p>
            <div className="flex flex-wrap gap-2">
              {[...(brand.primaryColors ?? []), ...(brand.secondaryColors ?? [])].map((color) => (
                <div key={color} className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg border border-gray-200 shadow-sm" style={{ backgroundColor: color }} />
                  <span className="text-xs text-gray-500 font-mono">{color}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Brand stage */}
        <div>
          <p className="text-xs text-gray-400 mb-1.5">Brand stage</p>
          <select
            value={brand.brandStage ?? "startup"}
            onChange={(e) => patch({ brandStage: e.target.value } as never)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
          >
            {["idea", "startup", "growth", "established", "enterprise"].map((s) => (
              <option key={s} value={s} className="capitalize">{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Brand Story */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-5">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-900">Brand story & values</h2>
        </div>
        <EditableTextField label="Mission statement" value={brand.missionStatement} placeholder="What you do and for whom" multiline onSave={(v) => patch({ missionStatement: v || null } as never)} />
        <EditableTextField label="Vision statement" value={brand.visionStatement} placeholder="Long-term ambition" multiline onSave={(v) => patch({ visionStatement: v || null } as never)} />
        <EditableTextField label="Origin story" value={brand.originStory} placeholder="How and why the brand was started" multiline onSave={(v) => patch({ originStory: v || null } as never)} />

        {(brand.coreValues?.length ?? 0) > 0 && (
          <div>
            <p className="text-xs text-gray-400 mb-1.5">Core values</p>
            <div className="flex flex-wrap gap-1.5">
              {brand.coreValues!.map((v) => (
                <span key={v.label} className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-100">
                  {v.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Voice & Tone */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-5">
        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-900">Voice & tone</h2>
        </div>

        {activeVoiceTraits.length > 0 && (
          <div>
            <p className="text-xs text-gray-400 mb-1.5">Personality traits</p>
            <div className="flex flex-wrap gap-1.5">
              {activeVoiceTraits.map((t) => (
                <span key={t} className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full capitalize">{t}</span>
              ))}
            </div>
          </div>
        )}

        {(brand.toneDescriptors?.length ?? 0) > 0 && (
          <div>
            <p className="text-xs text-gray-400 mb-1.5">Tone descriptors</p>
            <div className="flex flex-wrap gap-1.5">
              {brand.toneDescriptors!.map((s) => (
                <span key={s} className="text-xs bg-purple-50 text-purple-700 px-2.5 py-1 rounded-full">{s}</span>
              ))}
            </div>
          </div>
        )}

        {/* Voice examples */}
        <EditableTagList
          label="Voice examples (paste real posts you love)"
          values={brand.voiceExamples ?? []}
          onSave={(v) => patch({ voiceExamples: v } as never)}
          placeholder="Paste an example post…"
          colorClass="bg-indigo-50 text-indigo-700 border border-indigo-100"
        />

        <TonePreview brandId={id} />
      </div>

      {/* Content Strategy */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-5">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-900">Content strategy</h2>
        </div>

        {(brand.brandContext?.contentPillars?.length ?? 0) > 0 && (
          <div>
            <p className="text-xs text-gray-400 mb-1.5">Content pillars</p>
            <div className="flex flex-wrap gap-1.5">
              {brand.brandContext!.contentPillars!.map((p) => (
                <span key={p} className="text-xs bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full">{p}</span>
              ))}
            </div>
          </div>
        )}

        <EditableTagList
          label="Content do's"
          values={brand.contentDos ?? []}
          onSave={(v) => patch({ contentDos: v } as never)}
          placeholder="e.g. Always include a CTA"
          colorClass="bg-green-50 text-green-700 border border-green-100"
        />

        <EditableTagList
          label="Content don'ts"
          values={brand.contentDonts ?? []}
          onSave={(v) => patch({ contentDonts: v } as never)}
          placeholder="e.g. Never use corporate jargon"
          colorClass="bg-orange-50 text-orange-700 border border-orange-100"
        />

        <EditableTagList
          label="Banned words / phrases"
          values={brand.bannedWords ?? []}
          onSave={(v) => patch({ bannedWords: v } as never)}
          placeholder="e.g. cheap, cheap price"
          colorClass="bg-red-50 text-red-700 border border-red-100"
        />

        <EditableTagList
          label="Posting languages"
          values={brand.postingLanguages ?? ["en"]}
          onSave={(v) => patch({ postingLanguages: v } as never)}
          placeholder="e.g. en, es, fr"
          colorClass="bg-gray-100 text-gray-700"
        />
      </div>

      {/* Social handles */}
      {(Object.keys(brand.socialHandles ?? {}).length > 0) && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900">Social handles</h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(brand.socialHandles!).map(([platform, handle]) => (
              <div key={platform} className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-xs font-medium text-gray-500 capitalize w-20 shrink-0">{platform}</span>
                <span className="text-xs text-gray-700 truncate">{handle}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Audience */}
      {((brand.brandContext?.audienceNotes?.length ?? 0) > 0 || (brand.audiencePersonas?.length ?? 0) > 0) && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Languages className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900">Audience & market</h2>
          </div>

          {(brand.brandContext?.audienceNotes?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-1.5">Audience notes</p>
              <ul className="space-y-1">
                {brand.brandContext!.audienceNotes!.map((note) => (
                  <li key={note} className="text-sm text-gray-600 flex gap-2"><span className="text-gray-300 shrink-0">·</span>{note}</li>
                ))}
              </ul>
            </div>
          )}

          {(brand.geographicFocus?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-1.5">Geographic focus</p>
              <div className="flex flex-wrap gap-1.5">
                {brand.geographicFocus!.map((g) => (
                  <span key={g} className="text-xs bg-sky-50 text-sky-700 px-2.5 py-1 rounded-full">{g}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Brand knowledge */}
      {(brand.brandContext?.brandStatements?.length ?? 0) > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900">Brand knowledge</h2>
          </div>
          <ul className="space-y-1">
            {brand.brandContext!.brandStatements!.map((s) => (
              <li key={s} className="text-sm text-gray-600 flex gap-2"><span className="text-gray-300 shrink-0">·</span>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Products & services */}
      {(brand.brandContext?.productsServices?.length ?? 0) > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Products & services</h2>
          <div className="flex flex-wrap gap-1.5">
            {brand.brandContext!.productsServices!.map((item) => (
              <span key={item} className="text-xs bg-green-50 text-green-700 px-2.5 py-1 rounded-full">{item}</span>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Known competitors</h2>
          <Link
            href={`/dashboard/brands/${id}/competitive`}
            className="text-xs text-purple-600 hover:text-purple-700 font-medium"
          >
            {(competitorsList?.length ?? 0) > 0 ? "View intel →" : "Add competitors →"}
          </Link>
        </div>
        {(competitorsList?.length ?? 0) > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {competitorsList!.map((c) => (
              <span key={c.id} className="text-xs bg-purple-50 text-purple-700 border border-purple-100 px-2.5 py-1 rounded-full font-medium">
                {c.name}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No competitors tracked yet. Ingest a document mentioning competitors, or add them manually.</p>
        )}
        <p className="text-xs text-gray-400">Auto-discovered from ingested documents. Manage in Competitive Intelligence.</p>
      </div>

      {/* AI Quality Improvement */}
      <QualityImprovement brandId={id} />

      <p className="text-xs text-gray-400 pb-2">
        Brand created {new Date(brand.createdAt).toLocaleDateString()}.
        Ingest additional documents to improve voice fidelity.
      </p>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete brand"
          description="This will permanently delete the brand and all its AI memory. This cannot be undone."
          confirmLabel="Delete brand"
          isPending={deleteBrand.isPending}
          onConfirm={() => deleteBrand.mutate()}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
