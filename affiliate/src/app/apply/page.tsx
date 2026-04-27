"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Handshake, CheckCircle } from "lucide-react";
import { api } from "@/lib/api";

export default function AffiliateApplyPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    payoutEmail: "",
    website: "",
    agreed: false,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  function set(field: string, value: string | boolean) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.agreed) { setError("You must accept the affiliate agreement to continue."); return; }
    setLoading(true);
    setError("");
    try {
      await api.post("/auth/register", {
        name: form.name,
        email: form.email,
        password: form.password,
        organizationName: form.name,
      });
      await api.post("/affiliates/apply", {
        name: form.name,
        payoutEmail: form.payoutEmail || form.email,
        website: form.website || null,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Application failed");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-14 h-14 bg-green-900/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-7 h-7 text-green-400" />
          </div>
          <h1 className="text-lg font-bold text-white mb-2">Application received!</h1>
          <p className="text-sm text-gray-400 mb-6">
            Our team will review your application and get back to you within 1–2 business days. You&apos;ll receive a welcome email once approved.
          </p>
          <button
            onClick={() => router.push("/login")}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            Back to sign-in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-9 h-9 bg-purple-600 rounded-xl flex items-center justify-center">
            <Handshake className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold text-white">Anthyx Affiliates</span>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-7">
          <h1 className="text-base font-semibold text-white mb-1">Become a partner</h1>
          <p className="text-xs text-gray-500 mb-5">Earn 20% recurring commission on every referral you bring in.</p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-950 border border-red-800 text-red-400 text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Full name</label>
              <input
                type="text" value={form.name} onChange={(e) => set("name", e.target.value)} required
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Email</label>
              <input
                type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Password</label>
              <input
                type="password" value={form.password} onChange={(e) => set("password", e.target.value)} required minLength={8}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="pt-1 border-t border-gray-800">
              <p className="text-xs font-medium text-gray-400 mb-3 pt-2">Payout details</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Payout email <span className="text-gray-600">(PayPal or bank transfer)</span>
                  </label>
                  <input
                    type="email" value={form.payoutEmail} onChange={(e) => set("payoutEmail", e.target.value)}
                    placeholder={form.email || "your@email.com"}
                    className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <p className="mt-1 text-xs text-gray-600">Leave blank to use your account email.</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Website / social profile <span className="text-gray-600">(optional)</span>
                  </label>
                  <input
                    type="url" value={form.website} onChange={(e) => set("website", e.target.value)}
                    placeholder="https://yoursite.com"
                    className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 pt-1">
              <input
                id="agree"
                type="checkbox"
                checked={form.agreed}
                onChange={(e) => set("agreed", e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded accent-purple-600 shrink-0 cursor-pointer"
              />
              <label htmlFor="agree" className="text-xs text-gray-400 leading-relaxed cursor-pointer">
                I agree to the{" "}
                <a href="/affiliate-agreement" target="_blank" className="text-purple-400 underline hover:text-purple-300">
                  Affiliate Agreement
                </a>
                , including the 20% commission structure, 30-day cookie window, and payout threshold of $50.
              </label>
            </div>

            <button
              type="submit" disabled={loading || !form.agreed}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-900 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-colors"
            >
              {loading ? "Applying…" : "Apply now"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-600 mt-4">
          Already a partner?{" "}
          <button onClick={() => router.push("/login")} className="text-purple-400 hover:text-purple-300 underline">
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}
