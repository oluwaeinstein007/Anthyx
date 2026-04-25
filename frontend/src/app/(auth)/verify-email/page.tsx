"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Zap, CheckCircle2, XCircle, Mail } from "lucide-react";
import { api } from "@/lib/api";

function VerifyEmailContent() {
  const params = useSearchParams();
  const success = params.get("success") === "1";
  const error = params.get("error");
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [resendError, setResendError] = useState("");

  async function handleResend() {
    setResending(true);
    setResendError("");
    try {
      await api.post("/auth/resend-verification");
      setResent(true);
    } catch (err) {
      setResendError(err instanceof Error ? err.message : "Failed to resend");
    } finally {
      setResending(false);
    }
  }

  if (success) {
    return (
      <div className="text-center">
        <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="w-7 h-7 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Email verified!</h1>
        <p className="text-sm text-gray-500 mb-6">Your email address has been confirmed.</p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition-colors"
        >
          Go to dashboard
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center">
        <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <XCircle className="w-7 h-7 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Link expired</h1>
        <p className="text-sm text-gray-500 mb-6">
          {error === "invalid_token"
            ? "This verification link has expired or already been used."
            : "Something went wrong with the verification link."}
        </p>
        {resendError && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{resendError}</div>
        )}
        {resent ? (
          <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">
            Verification email sent — check your inbox.
          </div>
        ) : (
          <button
            onClick={handleResend}
            disabled={resending}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            <Mail className="w-4 h-4" />
            {resending ? "Sending…" : "Resend verification email"}
          </button>
        )}
      </div>
    );
  }

  // Default state: show "check your inbox"
  return (
    <div className="text-center">
      <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
        <Mail className="w-7 h-7 text-green-600" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Check your inbox</h1>
      <p className="text-sm text-gray-500 mb-6 max-w-xs mx-auto">
        We sent you a verification link. Click it to confirm your email and get full access.
      </p>

      {resendError && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{resendError}</div>
      )}

      {resent ? (
        <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm mb-4">
          Verification email resent — check your inbox.
        </div>
      ) : (
        <button
          onClick={handleResend}
          disabled={resending}
          className="text-sm text-green-600 hover:text-green-700 font-medium"
        >
          {resending ? "Sending…" : "Resend email"}
        </button>
      )}

      <div className="mt-6">
        <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600">
          Skip for now
        </Link>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2.5 mb-10">
          <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
            <Zap className="w-4 h-4 text-white fill-white" />
          </div>
          <span className="text-base font-bold text-gray-900">Anthyx</span>
        </div>
        <Suspense>
          <VerifyEmailContent />
        </Suspense>
      </div>
    </div>
  );
}
