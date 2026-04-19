"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Link from "next/link";
import { Plus, Building2, ArrowRight, X } from "lucide-react";

interface Brand {
  id: string;
  name: string;
  industry: string | null;
  primaryColors: string[] | null;
  toneDescriptors: string[] | null;
  createdAt: string;
}

export default function BrandsPage() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", industry: "" });
  const [createError, setCreateError] = useState("");

  const { data: brands = [], isLoading } = useQuery<Brand[]>({
    queryKey: ["brands"],
    queryFn: () => api.get<Brand[]>("/brands"),
  });

  const create = useMutation({
    mutationFn: () => api.post<Brand>("/brands", form),
    onSuccess: () => {
      setCreating(false);
      setForm({ name: "", industry: "" });
      setCreateError("");
      qc.invalidateQueries({ queryKey: ["brands"] });
    },
    onError: (err) => {
      setCreateError(err instanceof Error ? err.message : "Failed to create brand");
    },
  });

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Brands</h1>
          <p className="text-sm text-gray-500 mt-1">Manage brand identities and their AI memory.</p>
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
            <button onClick={() => { setCreating(false); setCreateError(""); }} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            {createError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                {createError}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Brand name</label>
              <input
                placeholder="e.g. Meridian Labs"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Industry <span className="text-gray-400 font-normal">(optional)</span></label>
              <input
                placeholder="e.g. SaaS, E-commerce, Healthcare"
                value={form.industry}
                onChange={(e) => setForm({ ...form, industry: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
              <button
                onClick={() => setCreating(false)}
                className="px-5 py-2.5 border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 rounded-xl transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Brand list */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-36 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : brands.length === 0 ? (
        <div className="text-center py-20 bg-white border border-dashed border-gray-200 rounded-2xl">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-7 h-7 text-gray-400" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">No brands yet</h3>
          <p className="text-sm text-gray-500 mb-5">
            Add your first brand to start training your AI agents.
          </p>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" /> Add brand
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {brands.map((brand) => (
            <Link
              key={brand.id}
              href={`/dashboard/brands/${brand.id}`}
              className="group p-5 bg-white border border-gray-200 rounded-2xl hover:border-green-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-gray-500" />
                </div>
                {brand.primaryColors && brand.primaryColors.length > 0 && (
                  <div className="flex gap-1">
                    {brand.primaryColors.slice(0, 3).map((color) => (
                      <div
                        key={color}
                        className="w-4 h-4 rounded-full border-2 border-white shadow-sm ring-1 ring-gray-200"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                )}
              </div>
              <h3 className="font-semibold text-gray-900 mb-0.5">{brand.name}</h3>
              {brand.industry && (
                <p className="text-xs text-gray-400 mb-3">{brand.industry}</p>
              )}
              {brand.toneDescriptors && brand.toneDescriptors.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {brand.toneDescriptors.slice(0, 3).map((t) => (
                    <span key={t} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {t}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-1 text-xs text-green-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                View profile <ArrowRight className="w-3 h-3" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
