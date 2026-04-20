"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useState } from "react";
import { Download, FileText, Lock, Building2, Calendar, Loader2, AlertCircle } from "lucide-react";

interface Brand { id: string; name: string; }
interface Plan { id: string; name: string; brandProfileId: string; status: string; startDate: string; endDate: string; }

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:4000";

export default function ReportsPage() {
  const { data: brands = [], isLoading: brandsLoading } = useQuery<Brand[]>({
    queryKey: ["brands"],
    queryFn: () => api.get<Brand[]>("/brands"),
  });

  const { data: plans = [], isLoading: plansLoading } = useQuery<Plan[]>({
    queryKey: ["plans"],
    queryFn: () => api.get<Plan[]>("/plans"),
  });

  const isLoading = brandsLoading || plansLoading;
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  async function downloadReport(apiPath: string, filename: string) {
    setDownloading(filename);
    setDownloadError(null);
    try {
      const res = await fetch(`${API_URL}/v1${apiPath}`, {
        credentials: "include",
      });

      if (res.status === 403) {
        setDownloadError("Agency tier required to export CSV reports. Upgrade your plan to unlock this feature.");
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setDownloadError(body.error ?? `Download failed (${res.status})`);
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
      setDownloadError("Network error — please check your connection and try again.");
    } finally {
      setDownloading(null);
    }
  }

  const publishedPlans = plans.filter((p) => p.status === "completed" || p.status === "active");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500 mt-1">Export plan and brand performance data as CSV. Available on Agency tier and above.</p>
      </div>

      {downloadError && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">Export failed</p>
            <p className="text-xs text-red-600 mt-0.5">{downloadError}</p>
          </div>
          <button onClick={() => setDownloadError(null)} className="text-red-400 hover:text-red-600 text-sm">✕</button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4 animate-pulse">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl" />)}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Brand reports */}
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
                  return (
                    <div key={brand.id} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center shrink-0">
                          <Building2 className="w-4 h-4 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{brand.name}</p>
                          <p className="text-xs text-gray-400">All published posts · engagement breakdown</p>
                        </div>
                      </div>
                      <button
                        onClick={() => downloadReport(`/reports/brand/${brand.id}`, filename)}
                        disabled={!!downloading}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-xs font-medium rounded-xl transition-colors"
                      >
                        {isThis ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        {isThis ? "Exporting…" : "Export CSV"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Plan reports */}
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
                  return (
                    <div key={plan.id} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{plan.name}</p>
                          <p className="text-xs text-gray-400">
                            {brand?.name ?? "Unknown brand"} · {new Date(plan.startDate).toLocaleDateString()} – {new Date(plan.endDate).toLocaleDateString()}
                            <span className={`ml-2 inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium uppercase ${
                              plan.status === "completed" ? "bg-gray-100 text-gray-600" : "bg-green-100 text-green-700"
                            }`}>{plan.status}</span>
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => downloadReport(`/reports/plan/${plan.id}`, filename)}
                        disabled={!!downloading}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-medium rounded-xl transition-colors"
                      >
                        {isThis ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        {isThis ? "Exporting…" : "Export CSV"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Upgrade callout */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-4">
            <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
              <Lock className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-800">Agency tier required</p>
              <p className="text-xs text-amber-700 mt-0.5 max-w-md">
                CSV exports are available on Agency, Scale, and Enterprise plans. Upgrade your plan to download performance data.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
