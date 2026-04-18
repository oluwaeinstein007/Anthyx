"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Zap, ArrowRight, Check } from "lucide-react";
import { api } from "@/lib/api";

const PERKS = [
  "14-day free trial on Growth plan",
  "No credit card required",
  "Cancel anytime",
  "Full access from day one",
];

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", organizationName: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.post("/auth/register", form);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gray-900 p-12 flex-col justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
            <Zap className="w-4 h-4 text-white fill-white" />
          </div>
          <span className="text-base font-bold text-white">Anthyx</span>
        </Link>
        <div>
          <h2 className="text-3xl font-bold text-white mb-4 leading-tight">
            Your brand, everywhere,<br />automatically.
          </h2>
          <p className="text-gray-400 text-base mb-8 leading-relaxed">
            Connect your brand identity, let AI agents plan and write content, then approve and publish — all from one dashboard.
          </p>
          <ul className="space-y-3">
            {PERKS.map((p) => (
              <li key={p} className="flex items-center gap-3 text-sm text-gray-300">
                <div className="w-5 h-5 rounded-full bg-green-600/20 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 text-green-400" />
                </div>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-gray-500">Already trusted by 500+ marketing teams worldwide.</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <Link href="/" className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-white fill-white" />
            </div>
            <span className="text-base font-bold text-gray-900">Anthyx</span>
          </Link>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Create your account</h1>
            <p className="text-sm text-gray-500">Start your free 14-day Growth trial — no card needed.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Your name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={update("name")}
                  required
                  placeholder="Jane Smith"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Company / brand</label>
                <input
                  type="text"
                  value={form.organizationName}
                  onChange={update("organizationName")}
                  required
                  placeholder="Acme Inc."
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Work email</label>
              <input
                type="email"
                value={form.email}
                onChange={update("email")}
                required
                placeholder="you@company.com"
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={update("password")}
                required
                placeholder="8+ characters"
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 mt-2"
            >
              {loading ? "Creating account…" : <>Create free account <ArrowRight className="w-4 h-4" /></>}
            </button>

            <p className="text-xs text-gray-400 text-center">
              By signing up you agree to our{" "}
              <a href="#" className="underline hover:text-gray-600">Terms</a> and{" "}
              <a href="#" className="underline hover:text-gray-600">Privacy Policy</a>.
            </p>
          </form>

          <p className="mt-6 text-sm text-gray-500 text-center">
            Already have an account?{" "}
            <Link href="/login" className="text-green-600 hover:text-green-700 font-semibold">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
