"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Link from "next/link";
import { Pencil, Check, X, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

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
  ingestStatus: "idle" | "processing" | "done" | "failed" | null;
  voiceTraits: {
    professional?: boolean;
    witty?: boolean;
    aggressive?: boolean;
    empathetic?: boolean;
    authoritative?: boolean;
    casual?: boolean;
  } | null;
  toneDescriptors: string[] | null;
  primaryColors: string[] | null;
  secondaryColors: string[] | null;
  typography: { primary: string | null; secondary: string | null } | null;
  brandContext: BrandContext | null;
  createdAt: string;
}

export default function BrandDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editIndustry, setEditIndustry] = useState("");
  const [editError, setEditError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: brand, isLoading } = useQuery<BrandProfile>({
    queryKey: ["brand", id],
    queryFn: () => api.get<BrandProfile>(`/brands/${id}`),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 5000;
      if (data.ingestStatus === "processing") return 3000;
      const allColors = [...(data.primaryColors ?? []), ...(data.secondaryColors ?? [])];
      const hasData =
        allColors.length > 0 ||
        (data.toneDescriptors?.length ?? 0) > 0 ||
        (data.voiceTraits && Object.values(data.voiceTraits).some(Boolean));
      return hasData ? false : 5000;
    },
  });

  const updateBrand = useMutation({
    mutationFn: (body: { name?: string; industry?: string }) =>
      api.put(`/brands/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brand", id] });
      qc.invalidateQueries({ queryKey: ["brands"] });
      setEditing(false);
      setEditError("");
    },
    onError: (err) => {
      setEditError(err instanceof Error ? err.message : "Failed to update brand");
    },
  });

  const deleteBrand = useMutation({
    mutationFn: () => api.delete(`/brands/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brands"] });
      router.push("/dashboard/brands");
    },
  });

  const startEdit = () => {
    if (!brand) return;
    setEditName(brand.name);
    setEditIndustry(brand.industry ?? "");
    setEditError("");
    setEditing(true);
  };

  const saveEdit = () => {
    updateBrand.mutate({
      name: editName.trim() || undefined,
      industry: editIndustry.trim() || undefined,
    });
  };

  if (isLoading)
    return <div className="text-sm text-gray-500 animate-pulse">Loading brand...</div>;
  if (!brand) return <div className="text-sm text-gray-500">Brand not found.</div>;

  const allColors = [
    ...(brand.primaryColors ?? []),
    ...(brand.secondaryColors ?? []),
  ];

  const activeVoiceTraits = brand.voiceTraits
    ? Object.entries(brand.voiceTraits)
        .filter(([, active]) => active)
        .map(([trait]) => trait)
    : [];

  const hasData =
    allColors.length > 0 ||
    (brand.toneDescriptors?.length ?? 0) > 0 ||
    activeVoiceTraits.length > 0;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Back + header */}
      <div>
        <Link
          href="/dashboard/brands"
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          ← Brands
        </Link>
        <div className="flex items-start justify-between mt-2">
          <div className="flex-1 min-w-0 pr-4">
            {editing ? (
              <div className="space-y-3">
                {editError && (
                  <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                    {editError}
                  </div>
                )}
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full text-2xl font-bold text-gray-900 border-b border-gray-300 focus:outline-none focus:border-green-500 bg-transparent pb-1"
                  placeholder="Brand name"
                />
                <input
                  type="text"
                  value={editIndustry}
                  onChange={(e) => setEditIndustry(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Industry (optional)"
                />
                <div className="flex gap-2">
                  <button
                    onClick={saveEdit}
                    disabled={!editName.trim() || updateBrand.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {updateBrand.isPending ? "Saving..." : "Save changes"}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-gray-900">{brand.name}</h1>
                  <button
                    onClick={startEdit}
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors rounded"
                    title="Edit brand"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
                {brand.industry && (
                  <p className="text-sm text-gray-500 mt-0.5">{brand.industry}</p>
                )}
              </>
            )}
          </div>
          {!editing && (
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href={`/dashboard/brands/${id}/ingest`}
                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
              >
                Ingest document
              </Link>
              <button
                onClick={() => setConfirmDelete(true)}
                disabled={deleteBrand.isPending}
                className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-lg"
                title="Delete brand"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Ingestion status banner */}
      {brand.ingestStatus === "processing" && (
        <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-800">Processing document…</p>
            <p className="text-xs text-blue-600 mt-0.5">Extracting brand identity via AI. This takes 10–30 seconds.</p>
          </div>
        </div>
      )}
      {brand.ingestStatus === "failed" && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <span className="text-red-500 text-lg">✕</span>
          <div>
            <p className="text-sm font-medium text-red-800">Ingestion failed</p>
            <p className="text-xs text-red-600 mt-0.5">
              The document could not be processed.{" "}
              <Link href={`/dashboard/brands/${id}/ingest`} className="underline">Try again →</Link>
            </p>
          </div>
        </div>
      )}

      {/* Color palette */}
      {allColors.length > 0 && (
        <div className="p-5 bg-white border border-gray-200 rounded-xl space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Brand colors</h2>
          <div className="flex flex-wrap gap-3">
            {brand.primaryColors && brand.primaryColors.length > 0 && (
              <div className="w-full">
                <p className="text-xs text-gray-400 mb-2">Primary</p>
                <div className="flex flex-wrap gap-3">
                  {brand.primaryColors.map((color, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-lg border border-gray-200 shadow-sm"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-xs text-gray-500 font-mono">{color}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {brand.secondaryColors && brand.secondaryColors.length > 0 && (
              <div className="w-full">
                <p className="text-xs text-gray-400 mb-2">Secondary</p>
                <div className="flex flex-wrap gap-3">
                  {brand.secondaryColors.map((color, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-lg border border-gray-200 shadow-sm"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-xs text-gray-500 font-mono">{color}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Voice traits */}
      {(activeVoiceTraits.length > 0 || (brand.toneDescriptors?.length ?? 0) > 0) && (
        <div className="p-5 bg-white border border-gray-200 rounded-xl space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Voice & tone</h2>

          {activeVoiceTraits.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-1.5">Personality traits</p>
              <div className="flex flex-wrap gap-1.5">
                {activeVoiceTraits.map((t) => (
                  <span
                    key={t}
                    className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full capitalize"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {brand.toneDescriptors && brand.toneDescriptors.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-1.5">Tone descriptors</p>
              <div className="flex flex-wrap gap-1.5">
                {brand.toneDescriptors.map((s) => (
                  <span
                    key={s}
                    className="text-xs bg-purple-50 text-purple-700 px-2.5 py-1 rounded-full"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Typography */}
      {brand.typography && (brand.typography.primary || brand.typography.secondary) && (
        <div className="p-5 bg-white border border-gray-200 rounded-xl space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Typography</h2>
          <div className="space-y-1">
            {brand.typography.primary && (
              <p className="text-sm text-gray-700">
                <span className="text-xs text-gray-400 mr-2">Primary</span>
                {brand.typography.primary}
              </p>
            )}
            {brand.typography.secondary && (
              <p className="text-sm text-gray-700">
                <span className="text-xs text-gray-400 mr-2">Secondary</span>
                {brand.typography.secondary}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Products & Services */}
      {brand.brandContext?.productsServices && brand.brandContext.productsServices.length > 0 && (
        <div className="p-5 bg-white border border-gray-200 rounded-xl space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Products & services</h2>
          <div className="flex flex-wrap gap-1.5">
            {brand.brandContext.productsServices.map((item) => (
              <span key={item} className="text-xs bg-green-50 text-green-700 px-2.5 py-1 rounded-full">
                {item}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Value proposition & target market */}
      {(brand.brandContext?.valueProposition || brand.brandContext?.targetMarket) && (
        <div className="p-5 bg-white border border-gray-200 rounded-xl space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Positioning</h2>
          {brand.brandContext.valueProposition && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Value proposition</p>
              <p className="text-sm text-gray-700">{brand.brandContext.valueProposition}</p>
            </div>
          )}
          {brand.brandContext.targetMarket && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Target market</p>
              <p className="text-sm text-gray-700">{brand.brandContext.targetMarket}</p>
            </div>
          )}
        </div>
      )}

      {/* Content pillars */}
      {brand.brandContext?.contentPillars && brand.brandContext.contentPillars.length > 0 && (
        <div className="p-5 bg-white border border-gray-200 rounded-xl space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Content pillars</h2>
          <div className="flex flex-wrap gap-1.5">
            {brand.brandContext.contentPillars.map((pillar) => (
              <span key={pillar} className="text-xs bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full">
                {pillar}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Audience & brand statements */}
      {(brand.brandContext?.audienceNotes?.length || brand.brandContext?.brandStatements?.length) ? (
        <div className="p-5 bg-white border border-gray-200 rounded-xl space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Brand knowledge</h2>
          {brand.brandContext?.audienceNotes && brand.brandContext.audienceNotes.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-1.5">Audience notes</p>
              <ul className="space-y-1">
                {brand.brandContext.audienceNotes.map((note) => (
                  <li key={note} className="text-sm text-gray-600 flex gap-2">
                    <span className="text-gray-300 shrink-0">·</span>{note}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {brand.brandContext?.brandStatements && brand.brandContext.brandStatements.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-1.5">Key messages</p>
              <ul className="space-y-1">
                {brand.brandContext.brandStatements.map((s) => (
                  <li key={s} className="text-sm text-gray-600 flex gap-2">
                    <span className="text-gray-300 shrink-0">·</span>{s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}

      {/* If no extracted data yet */}
      {!hasData && (
        <div className="text-center py-12 bg-white border border-dashed border-gray-200 rounded-xl">
          <p className="text-gray-400 text-sm mb-3">
            No brand identity extracted yet.
          </p>
          <Link
            href={`/dashboard/brands/${id}/ingest`}
            className="text-sm text-green-600 font-medium hover:underline"
          >
            Ingest a brand document →
          </Link>
        </div>
      )}

      <p className="text-xs text-gray-400">
        Brand created {new Date(brand.createdAt).toLocaleDateString()}. Ingest additional
        documents to improve voice fidelity.
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
