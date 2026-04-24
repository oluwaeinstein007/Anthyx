"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useState } from "react";
import { Download, FileText, Lock, Building2, Calendar, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";

interface Brand { id: string; name: string; }
interface Plan { id: string; name: string; brandProfileId: string; status: string; startDate: string; endDate: string; }
interface Subscription { tier: string; status: string; }

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:4000";
const EXPORT_TIERS = new Set(["agency", "scale", "enterprise"]);

export default function ReportsPage() {
  const { data: brands = [], isLoading: brandsLoading } = useQuery<Brand[]>({
    queryKey: ["brands"],
    queryFn: () => api.get<Brand[]>("/brands"),
  });

  const { data: plans = [], isLoading: plansLoading } = useQuery<Plan[]>({
    queryKey: ["plans"],
    queryFn: () => api.get<Plan[]>("/plans"),
  });

  const { data: billing } = useQuery<{ subscription: Subscription }>({
    queryKey: ["billing", "subscription"],
    queryFn: () => api.get<{ subscription: Subscription }>("/billing/subscription"),
  });

  const isLoading = brandsLoading || plansLoading;
  const canExport = EXPORT_TIERS.has(billing?.subscription?.tier ?? "");

  const [downloading, setDownloading] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function downloadReport(apiPath: string, filename: string) {
    setDownloading(filename);
    setErrors((prev) => ({ ...prev, [filename]: "" }));
    try {
      const res = await fetch(`${API_URL}/v1${apiPath}`, { credentials: "include" });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setErrors((prev) => ({ ...prev, [filename]: body.error ?? `Export failed (${res.status})` }));
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setErrors((prev) => ({ ...prev, [filename]: "Network error — check your connection." }));
    } finally {
      setDownloading(null);
    }
  }

  const publishedPlans = plans.filter((p) => p.status === "completed" || p.status === "active");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500 mt-1">Export plan and brand performance data as CSV.</p>
      </div>

      {billing && !canExport && (
        <div className="flex items-center gap-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
          <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
            <Lock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">Agency tier required for CSV exports</p>
            <p className="text-xs text-amber-700 mt-0.5">Available on Agency, Scale, and Enterprise plans.</p>
          </div>
          <Link
            href="/dashboard/billing"
            className="shrink-0 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded-lg transition-colors"
          >
            Upgrade
          </Link>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4 animate-pulse">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl" />)}
        </div>
      ) : (
        <div className="space-y-6">
          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-green-600" />
              Brand performance reports
            </h2>
            {brands.length === 0 ? (
              <div className="bg-white border border-dashed border-gray-200 rounded-2xl py-10 text-center">
                <p className="text-sm text-gray-400">No brands yet.</p>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100">
                {brands.map((brand) => {
                  const filename = `${brand.name.toLowerCase().replace(/\s+/g, "-")}-report.csv`;
                  const isThis = downloading === filename;
                  const err = errors[filename];
                  return (
                    <div key={brand.id} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center shrink-0">
                          <Building2 className="w-4 h-4 text-green-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900">{brand.name}</p>
                          <p className="text-xs text-gray-400">All published posts · engagement breakdown</p>
                          {err && (
                            <p className="text-xs text-red-500 mt-0.5 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 shrink-0" />{err}
                            </p>
                          )}
                        </div>
                      </div>
                      {canExport ? (
                        <button
                          onClick={() => downloadReport(`/reports/brand/${brand.id}`, filename)}
                          disabled={!!downloading}
                          className="shrink-0 flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-xs font-medium rounded-xl transition-colors"
                        >
                          {isThis ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                          {isThis ? "Exporting…" : "Export CSV"}
                        </button>
                      ) : (
                        <Link
                          href="/dashboard/billing"
                          className="shrink-0 flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-500 text-xs font-medium rounded-xl transition-colors"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          Upgrade to export
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              Plan performance reports
            </h2>
            {publishedPlans.length === 0 ? (
              <div className="bg-white border border-dashed border-gray-200 rounded-2xl py-10 text-center">
                <p className="text-sm text-gray-400">No active or completed plans yet.</p>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100">
                {publishedPlans.map((plan) => {
                  const brand = brands.find((b) => b.id === plan.brandProfileId);
                  const filename = `plan-${plan.id}-report.csv`;
                  const isThis = downloading === filename;
                  const err = errors[filename];
                  return (
                    <div key={plan.id} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4 text-blue-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900">{plan.name}</p>
                          <p className="text-xs text-gray-400">
                            {brand?.name ?? "Unknown brand"} · {new Date(plan.startDate).toLocaleDateString()} – {new Date(plan.endDate).toLocaleDateString()}
                            <span className={`ml-2 inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium uppercase ${
                              plan.status === "completed" ? "bg-gray-100 text-gray-600" : "bg-green-100 text-green-700"
                            }`}>{plan.status}</span>
                          </p>
                          {err && (
                            <p className="text-xs text-red-500 mt-0.5 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 shrink-0" />{err}
                            </p>
                          )}
                        </div>
                      </div>
                      {canExport ? (
                        <button
                          onClick={() => downloadReport(`/reports/plan/${plan.id}`, filename)}
                          disabled={!!downloading}
                          className="shrink-0 flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-medium rounded-xl transition-colors"
                        >
                          {isThis ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                          {isThis ? "Exporting…" : "Export CSV"}
                        </button>
                      ) : (
                        <Link
                          href="/dashboard/billing"
                          className="shrink-0 flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-500 text-xs font-medium rounded-xl transition-colors"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          Upgrade to export
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
