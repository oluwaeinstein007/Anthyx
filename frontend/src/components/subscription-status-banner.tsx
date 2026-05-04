"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AlertTriangle, Clock, XCircle } from "lucide-react";
import Link from "next/link";

interface SubscriptionData {
  subscription: {
    status: string;
    gracePeriodEndsAt?: string | null;
    accessUntil?: string | null;
  };
}

export function SubscriptionStatusBanner() {
  const { data } = useQuery<SubscriptionData>({
    queryKey: ["billing"],
    queryFn: () => api.get<SubscriptionData>("/billing/subscription"),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const status = data?.subscription?.status;

  if (!status || status === "active" || status === "trialing") return null;

  if (status === "grace_period") {
    const endsAt = data?.subscription?.gracePeriodEndsAt;
    const daysLeft = endsAt
      ? Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 86_400_000))
      : null;

    return (
      <div className="flex items-center gap-3 px-6 py-3 bg-amber-50 border-b border-amber-200">
        <Clock className="w-4 h-4 text-amber-600 shrink-0" />
        <p className="text-sm text-amber-800 flex-1">
          <span className="font-semibold">Payment failed.</span>{" "}
          {daysLeft !== null ? `${daysLeft} day${daysLeft !== 1 ? "s" : ""} remaining in grace period.` : "Grace period active."}{" "}
          New posts are paused until payment is resolved.
        </p>
        <Link
          href="/dashboard/billing"
          className="text-xs font-semibold text-amber-900 underline underline-offset-2 shrink-0"
        >
          Update payment →
        </Link>
      </div>
    );
  }

  if (status === "suspended") {
    return (
      <div className="flex items-center gap-3 px-6 py-3 bg-red-50 border-b border-red-200">
        <XCircle className="w-4 h-4 text-red-600 shrink-0" />
        <p className="text-sm text-red-800 flex-1">
          <span className="font-semibold">Your subscription has lapsed.</span>{" "}
          All scheduled posts are paused. Reactivate to resume posting.
        </p>
        <Link
          href="/dashboard/billing"
          className="text-xs font-semibold text-red-900 underline underline-offset-2 shrink-0"
        >
          Reactivate →
        </Link>
      </div>
    );
  }

  if (status === "past_due") {
    return (
      <div className="flex items-center gap-3 px-6 py-3 bg-amber-50 border-b border-amber-200">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
        <p className="text-sm text-amber-800 flex-1">
          <span className="font-semibold">Payment past due.</span>{" "}
          Please update your payment method to avoid service interruption.
        </p>
        <Link
          href="/dashboard/billing"
          className="text-xs font-semibold text-amber-900 underline underline-offset-2 shrink-0"
        >
          Update payment →
        </Link>
      </div>
    );
  }

  return null;
}
