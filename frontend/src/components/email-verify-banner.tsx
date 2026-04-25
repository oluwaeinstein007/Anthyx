"use client";

import { useState, useEffect } from "react";
import { Mail, X } from "lucide-react";
import { api } from "@/lib/api";

interface MeResponse { id: string; email: string; emailVerified?: boolean }

export function EmailVerifyBanner() {
  const [show, setShow] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    api.get<MeResponse>("/auth/me")
      .then((me) => { if (me.emailVerified === false) setShow(true); })
      .catch(() => { /* ignore — not critical */ });
  }, []);

  async function handleResend() {
    setResending(true);
    try {
      await api.post("/auth/resend-verification");
      setResent(true);
    } finally {
      setResending(false);
    }
  }

  if (!show) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2 text-amber-800">
        <Mail className="w-4 h-4 shrink-0" />
        <span className="text-xs font-medium">Please verify your email address to unlock all features.</span>
        {resent ? (
          <span className="text-xs text-green-700">Verification email sent!</span>
        ) : (
          <button
            onClick={handleResend}
            disabled={resending}
            className="text-xs underline hover:no-underline text-amber-700 font-semibold"
          >
            {resending ? "Sending…" : "Resend email"}
          </button>
        )}
      </div>
      <button onClick={() => setShow(false)} className="text-amber-500 hover:text-amber-700 shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
