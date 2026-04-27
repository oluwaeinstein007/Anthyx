"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Link from "next/link";
import {
  Plus, Building2, ArrowRight, X, Search, Archive, ArchiveRestore,
  Copy, Globe, AlertCircle, CheckCircle2, Filter,
} from "lucide-react";

interface Brand {
  id: string;
  name: string;
  industry: string | null;
  primaryColors: string[] | null;
  toneDescriptors: string[] | null;
  logoUrl: string | null;
  tagline: string | null;
  websiteUrl: string | null;
  archivedAt: string | null;
  createdAt: string;
  _stats: { totalPosts: number; pendingReview: number };
}

function BrandAvatar({ brand }: { brand: Brand }) {
  if (brand.logoUrl) {
    return (
      <img
        src={brand.logoUrl}
        alt={brand.name}
        className="w-10 h-10 rounded-xl object-cover border border-gray-100"
      />
    );
  }
  const initials = brand.name.slice(0, 2).toUpperCase();
  const color = brand.primaryColors?.[0] ?? "#6b7280";
  return (
    <div
      className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0"
      style={{ backgroundColor: color }}
    >
      {initials}
    </div>
  );
}

export default function BrandsPage() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", industry: "" });
  const [createError, setCreateError] = useState("");
  const [search, setSearch] = useState("");
  const [filterIndustry, setFilterIndustry] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);

  const { data: brands = [], isLoading } = useQuery<Brand[]>({
    queryKey: ["brands", showArchived],
    queryFn: () => api.get<Brand[]>(`/brands${showArchived ? "?includeArchived=true" : ""}`),
  });

  const industries = [...new Set(brands.map((b) => b.industry).filter(Boolean))] as string[];

  const filtered = brands.filter((b) => {
    const matchesSearch = !search || b.name.toLowerCase().includes(search.toLowerCase()) || b.industry?.toLowerCase().includes(search.toLowerCase());
    const matchesIndustry = !filterIndustry || b.industry === filterIndustry;
    return matchesSearch && matchesIndustry;
  });

  const create = useMutation({
    mutationFn: () => api.post<Brand>("/brands", form),
    onSuccess: () => {
      setCreating(false);
      setForm({ name: "", industry: "" });
      setCreateError("");
      qc.invalidateQueries({ queryKey: ["brands"] });
    },
    onError: (err) => setCreateError(err instanceof Error ? err.message : "Failed to create brand"),
  });

  const archive = useMutation({
    mutationFn: (id: string) => api.post(`/brands/${id}/archive`, {}),
    onSuccess: () => { setConfirmArchiveId(null); qc.invalidateQueries({ queryKey: ["brands"] }); },
  });

  const unarchive = useMutation({
    mutationFn: (id: string) => api.post(`/brands/${id}/unarchive`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["brands"] }),
  });

  const duplicate = useMutation({
    mutationFn: (id: string) => api.post<Brand>(`/brands/${id}/duplicate`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["brands"] }),
  });

  const activeCount = brands.filter((b) => !b.archivedAt).length;
  const archivedCount = brands.filter((b) => !!b.archivedAt).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Brands</h1>
          <p className="text-sm text-gray-500 mt-1">
            {activeCount} active brand{activeCount !== 1 ? "s" : ""}
            {archivedCount > 0 && ` · ${archivedCount} archived`}
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" /> Add brand
        </button>
      </div>

      {/* Create form */}
      {creating && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">New brand</h2>
            <button onClick={() => { setCreating(false); setCreateError(""); }} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            {createError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" /> {createError}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Brand name *</label>
              <input
                placeholder="e.g. Meridian Labs"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter" && form.name) create.mutate(); }}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Industry <span className="text-gray-400 font-normal">(optional)</span></label>
              <input
                placeholder="e.g. SaaS, E-commerce, Healthcare"
                value={form.industry}
                onChange={(e) => setForm({ ...form, industry: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter" && form.name) create.mutate(); }}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => create.mutate()}
                disabled={!form.name || create.isPending}
                className="px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-sm font-medium rounded-xl transition-colors"
              >
                {create.isPending ? "Creating…" : "Create brand"}
              </button>
              <button onClick={() => setCreating(false)} className="px-5 py-2.5 border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 rounded-xl transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search + filter bar */}
      {brands.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search brands…"
              className="w-full pl-9 pr-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          {industries.length > 1 && (
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <select
                value={filterIndustry}
                onChange={(e) => setFilterIndustry(e.target.value)}
                className="pl-8 pr-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
              >
                <option value="">All industries</option>
                {industries.map((ind) => <option key={ind} value={ind}>{ind}</option>)}
              </select>
            </div>
          )}
          {archivedCount > 0 && (
            <button
              onClick={() => setShowArchived((s) => !s)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm border transition-colors ${showArchived ? "bg-amber-50 border-amber-200 text-amber-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
            >
              <Archive className="w-4 h-4" />
              {showArchived ? "Hide archived" : `Show archived (${archivedCount})`}
            </button>
          )}
        </div>
      )}

      {/* Brand grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-44 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        brands.length === 0 ? (
          <div className="text-center py-20 bg-white border border-dashed border-gray-200 rounded-2xl">
            <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-7 h-7 text-gray-400" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">No brands yet</h3>
            <p className="text-sm text-gray-500 mb-5">Add your first brand to start training your AI agents.</p>
            <button
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" /> Add brand
            </button>
          </div>
        ) : (
          <p className="text-center text-sm text-gray-500 py-12">No brands match your search.</p>
        )
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((brand) => (
            <div
              key={brand.id}
              className={`group bg-white border rounded-2xl overflow-hidden transition-all ${brand.archivedAt ? "border-gray-200 opacity-70" : "border-gray-200 hover:border-green-300 hover:shadow-sm"}`}
            >
              {brand.archivedAt && (
                <div className="bg-amber-50 border-b border-amber-100 px-4 py-1.5 flex items-center gap-1.5">
                  <Archive className="w-3 h-3 text-amber-600" />
                  <span className="text-xs text-amber-700 font-medium">Archived</span>
                </div>
              )}

              <Link href={`/dashboard/brands/${brand.id}`} className="block p-5">
                <div className="flex items-start justify-between mb-3">
                  <BrandAvatar brand={brand} />
                  {brand.primaryColors && brand.primaryColors.length > 0 && (
                    <div className="flex gap-1">
                      {brand.primaryColors.slice(0, 4).map((color) => (
                        <div
                          key={color}
                          className="w-4 h-4 rounded-full border border-white shadow-sm ring-1 ring-gray-100"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <h3 className="font-semibold text-gray-900 leading-snug">{brand.name}</h3>
                {brand.tagline && <p className="text-xs text-gray-500 italic mt-0.5 truncate">{brand.tagline}</p>}
                {brand.industry && !brand.tagline && (
                  <p className="text-xs text-gray-400 mt-0.5">{brand.industry}</p>
                )}

                {brand.toneDescriptors && brand.toneDescriptors.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {brand.toneDescriptors.slice(0, 3).map((t) => (
                      <span key={t} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{t}</span>
                    ))}
                  </div>
                )}

                {/* Quick stats */}
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                  <span>{brand._stats.totalPosts.toLocaleString()} posts</span>
                  {brand._stats.pendingReview > 0 && (
                    <span className="flex items-center gap-1 text-amber-600 font-medium">
                      <AlertCircle className="w-3 h-3" />
                      {brand._stats.pendingReview} pending
                    </span>
                  )}
                  {brand.websiteUrl && (
                    <span className="flex items-center gap-1 ml-auto text-gray-400 truncate">
                      <Globe className="w-3 h-3 shrink-0" />
                      <span className="truncate max-w-[80px]">{brand.websiteUrl.replace(/^https?:\/\//, "")}</span>
                    </span>
                  )}
                </div>
              </Link>

              {/* Card actions */}
              <div className="px-5 pb-4 flex items-center justify-between">
                <Link
                  href={`/dashboard/brands/${brand.id}`}
                  className="flex items-center gap-1 text-xs text-green-600 font-medium hover:text-green-700 transition-colors"
                >
                  View profile <ArrowRight className="w-3 h-3" />
                </Link>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => { e.preventDefault(); duplicate.mutate(brand.id); }}
                    disabled={duplicate.isPending}
                    title="Duplicate brand"
                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  {brand.archivedAt ? (
                    <button
                      onClick={(e) => { e.preventDefault(); unarchive.mutate(brand.id); }}
                      title="Restore brand"
                      className="p-1.5 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                    >
                      <ArchiveRestore className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={(e) => { e.preventDefault(); setConfirmArchiveId(brand.id); }}
                      title="Archive brand"
                      className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Archive confirm inline */}
              {confirmArchiveId === brand.id && (
                <div className="mx-5 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs">
                  <p className="text-amber-800 font-medium mb-2">Archive <span className="font-semibold">{brand.name}</span>?</p>
                  <p className="text-amber-700 mb-3">The brand will be hidden from your workspace. You can restore it anytime.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => archive.mutate(brand.id)}
                      disabled={archive.isPending}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                      {archive.isPending ? "Archiving…" : "Archive"}
                    </button>
                    <button
                      onClick={() => setConfirmArchiveId(null)}
                      className="px-3 py-1.5 border border-amber-200 bg-white text-amber-700 rounded-lg hover:bg-amber-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
