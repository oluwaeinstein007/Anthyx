"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Link from "next/link";

interface BrandProfile {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  colorPalette: string[];
  voiceTraits: {
    tone: string[];
    style: string[];
    avoid: string[];
  } | null;
  targetAudience: string | null;
  values: string[];
  createdAt: string;
}

export default function BrandDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: brand, isLoading } = useQuery<BrandProfile>({
    queryKey: ["brand", id],
    queryFn: () => api.get<BrandProfile>(`/brands/${id}`),
  });

  if (isLoading)
    return <div className="text-sm text-gray-500 animate-pulse">Loading brand...</div>;
  if (!brand) return <div className="text-sm text-gray-500">Brand not found.</div>;

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
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{brand.name}</h1>
            {brand.industry && (
              <p className="text-sm text-gray-500 mt-0.5">{brand.industry}</p>
            )}
            {brand.website && (
              <a
                href={brand.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-500 hover:underline mt-0.5 inline-block"
              >
                {brand.website}
              </a>
            )}
          </div>
          <Link
            href={`/dashboard/brands/${id}/ingest`}
            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
          >
            Ingest document
          </Link>
        </div>
      </div>

      {/* Color palette */}
      {brand.colorPalette.length > 0 && (
        <div className="p-5 bg-white border border-gray-200 rounded-xl space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Brand colors</h2>
          <div className="flex flex-wrap gap-3">
            {brand.colorPalette.map((color, i) => (
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

      {/* Voice traits */}
      {brand.voiceTraits && (
        <div className="p-5 bg-white border border-gray-200 rounded-xl space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Voice & tone</h2>

          {brand.voiceTraits.tone.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-1.5">Tone</p>
              <div className="flex flex-wrap gap-1.5">
                {brand.voiceTraits.tone.map((t) => (
                  <span
                    key={t}
                    className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {brand.voiceTraits.style.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-1.5">Style</p>
              <div className="flex flex-wrap gap-1.5">
                {brand.voiceTraits.style.map((s) => (
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

          {brand.voiceTraits.avoid.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-1.5">Avoid</p>
              <div className="flex flex-wrap gap-1.5">
                {brand.voiceTraits.avoid.map((a) => (
                  <span
                    key={a}
                    className="text-xs bg-red-50 text-red-600 px-2.5 py-1 rounded-full"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Values */}
      {brand.values.length > 0 && (
        <div className="p-5 bg-white border border-gray-200 rounded-xl space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Brand values</h2>
          <div className="flex flex-wrap gap-1.5">
            {brand.values.map((v) => (
              <span
                key={v}
                className="text-xs bg-green-50 text-green-700 px-2.5 py-1 rounded-full border border-green-200"
              >
                {v}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Target audience */}
      {brand.targetAudience && (
        <div className="p-5 bg-white border border-gray-200 rounded-xl space-y-2">
          <h2 className="text-sm font-semibold text-gray-900">Target audience</h2>
          <p className="text-sm text-gray-700">{brand.targetAudience}</p>
        </div>
      )}

      {/* If no extracted data yet */}
      {!brand.voiceTraits &&
        brand.values.length === 0 &&
        brand.colorPalette.length === 0 && (
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
    </div>
  );
}
