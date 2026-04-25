"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { api } from "@/lib/api";

interface PromoCode {
  id: string;
  code: string;
  discountType: string;
  discountValue: number;
  applicableTiers: string[] | null;
  maxUses: number | null;
  usedCount: number;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
}

const TIERS = ["free", "starter", "pro", "agency"];

export default function PromoCodesPage() {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const [form, setForm] = useState({
    code: "",
    discountType: "percent",
    discountValue: "",
    maxUses: "",
    expiresAt: "",
    applicableTiers: [] as string[],
  });
  const [creating, setCreating] = useState(false);

  function load() {
    setLoading(true);
    api.get<PromoCode[]>("/admin/promo-codes")
      .then(setCodes)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function toggleTier(t: string) {
    setForm((f) => ({
      ...f,
      applicableTiers: f.applicableTiers.includes(t)
        ? f.applicableTiers.filter((x) => x !== t)
        : [...f.applicableTiers, t],
    }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post("/admin/promo-codes", {
        code: form.code,
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        maxUses: form.maxUses ? Number(form.maxUses) : undefined,
        expiresAt: form.expiresAt || undefined,
        applicableTiers: form.applicableTiers.length ? form.applicableTiers : undefined,
      });
      setShowCreate(false);
      setForm({ code: "", discountType: "percent", discountValue: "", maxUses: "", expiresAt: "", applicableTiers: [] });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(id: string, current: boolean) {
    try {
      await api.patch(`/admin/promo-codes/${id}`, { isActive: !current });
      setCodes((prev) => prev.map((c) => c.id === id ? { ...c, isActive: !current } : c));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Promo Codes</h1>
          <p className="text-sm text-gray-500 mt-1">{codes.length} codes</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" /> New code
        </button>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-950 border border-red-800 text-red-400 text-sm">{error}</div>}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-white">Create promo code</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Code</label>
                <input
                  required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white uppercase placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="LAUNCH50"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Type</label>
                  <select value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value })}
                    className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500">
                    <option value="percent">Percent</option>
                    <option value="flat">Flat ($)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Value</label>
                  <input
                    required type="number" min="0" step="0.01"
                    value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                    className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder={form.discountType === "percent" ? "20" : "10.00"}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Max uses</label>
                  <input
                    type="number" min="1" value={form.maxUses}
                    onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                    className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="Unlimited"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Expires at</label>
                  <input
                    type="date" value={form.expiresAt}
                    onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                    className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">Applicable tiers (empty = all)</label>
                <div className="flex flex-wrap gap-2">
                  {TIERS.map((t) => (
                    <button
                      key={t} type="button"
                      onClick={() => toggleTier(t)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                        form.applicableTiers.includes(t) ? "bg-red-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"
                      }`}
                    >{t}</button>
                  ))}
                </div>
              </div>
              <button
                type="submit" disabled={creating}
                className="w-full py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-900 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                {creating ? "Creating…" : "Create"}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Loading…</div>
        ) : codes.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">No promo codes yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Code</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Discount</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Uses</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Expires</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => (
                <tr key={c.id} className="border-b border-gray-800 last:border-0">
                  <td className="px-5 py-3 font-mono font-bold text-white">{c.code}</td>
                  <td className="px-5 py-3 text-gray-300">
                    {c.discountType === "percent" ? `${c.discountValue}%` : `$${c.discountValue}`}
                  </td>
                  <td className="px-5 py-3 text-gray-400">
                    {c.usedCount}{c.maxUses ? ` / ${c.maxUses}` : ""}
                  </td>
                  <td className="px-5 py-3 text-gray-400">
                    {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : "Never"}
                  </td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => toggleActive(c.id, c.isActive)}
                      className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${
                        c.isActive ? "bg-green-900/50 text-green-400 hover:bg-green-900" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                      }`}
                    >
                      {c.isActive ? "active" : "inactive"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
