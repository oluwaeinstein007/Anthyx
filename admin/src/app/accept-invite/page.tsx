"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Shield, Eye, EyeOff, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

const ROLE_LABELS: Record<string, string> = {
  owner:   "Owner",
  admin:   "Admin",
  support: "Support",
  billing: "Billing",
};

interface InviteDetails {
  email: string;
  role: string;
  expiresAt: string;
}

function AcceptInviteForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [tokenError, setTokenError] = useState("");
  const [verifying, setVerifying] = useState(true);

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setTokenError("No invite token found in URL.");
      setVerifying(false);
      return;
    }

    api.get<InviteDetails>(`/auth/admin/invite?token=${token}`)
      .then((data) => { setInvite(data); setVerifying(false); })
      .catch((err) => {
        setTokenError(err instanceof Error ? err.message : "Invalid or expired invite");
        setVerifying(false);
      });
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setSubmitError("Passwords do not match");
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      await api.post("/auth/admin/accept-invite", { token, name, password });
      setDone(true);
      setTimeout(() => router.push("/dashboard"), 1500);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setSubmitting(false);
    }
  }

  if (verifying) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <Loader2 className="w-6 h-6 text-gray-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-9 h-9 bg-red-600 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold text-white">Anthyx Admin</span>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-7">
          {tokenError ? (
            <div className="text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
              <h1 className="text-base font-semibold text-white">Invalid invite</h1>
              <p className="text-sm text-gray-400">{tokenError}</p>
            </div>
          ) : done ? (
            <div className="text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto" />
              <h1 className="text-base font-semibold text-white">Account created!</h1>
              <p className="text-sm text-gray-400">Redirecting to dashboard…</p>
            </div>
          ) : (
            <>
              <div className="mb-5">
                <h1 className="text-base font-semibold text-white">Set up your account</h1>
                <p className="text-xs text-gray-400 mt-1">
                  Invited as{" "}
                  <span className="text-white font-medium">{invite?.email}</span>{" "}
                  · Role: <span className="text-red-400">{ROLE_LABELS[invite?.role ?? ""] ?? invite?.role}</span>
                </p>
              </div>

              {submitError && (
                <div className="mb-4 flex items-center gap-2 p-3 bg-red-950 border border-red-800 rounded-lg text-sm text-red-400">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {submitError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Full name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Your name"
                    className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Password *</label>
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      placeholder="At least 8 characters"
                      className="w-full px-3 py-2.5 pr-10 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Confirm password *</label>
                  <input
                    type={showPw ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Repeat your password"
                    className={`w-full px-3 py-2.5 bg-gray-800 border rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 ${
                      confirmPassword && confirmPassword !== password ? "border-red-700" : "border-gray-700"
                    }`}
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || !name || !password || password !== confirmPassword}
                  className="w-full py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-900 disabled:text-red-600 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating account…
                    </span>
                  ) : (
                    "Create account & sign in"
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <Loader2 className="w-6 h-6 text-gray-500 animate-spin" />
      </div>
    }>
      <AcceptInviteForm />
    </Suspense>
  );
}
