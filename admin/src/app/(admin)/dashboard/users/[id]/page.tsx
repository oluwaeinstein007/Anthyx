"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { ArrowLeft, UserCheck, Shield, Mail, Calendar, Building2 } from "lucide-react";
import Link from "next/link";

interface UserDetail {
  id: string;
  name: string;
  email: string;
  role: string;
  isSuperAdmin: boolean;
  emailVerified: boolean;
  organizationId: string | null;
  createdAt: string;
}

interface Subscription {
  id: string;
  tier: string;
  status: string;
  billingProvider: string;
  billingInterval: string;
  currentPeriodEnd: string | null;
}

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [impersonating, setImpersonating] = useState(false);
  const [impersonateToken, setImpersonateToken] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<UserDetail>(`/admin/users/${id}`)
      .then((u) => {
        setUser(u);
        if (u.organizationId) {
          return api
            .get<{ subscription: Subscription }>(`/admin/organizations/${u.organizationId}`)
            .then((r) => setSub(r.subscription))
            .catch(() => null);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleImpersonate() {
    if (!user) return;
    setImpersonating(true);
    try {
      const r = await api.post<{ token: string }>(`/admin/users/${user.id}/impersonate`);
      setImpersonateToken(r.token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impersonation failed");
    } finally {
      setImpersonating(false);
    }
  }

  if (loading) return <div className="text-sm text-gray-500 animate-pulse">Loading…</div>;
  if (error) return <div className="p-4 rounded-lg bg-red-950 border border-red-800 text-red-400 text-sm">{error}</div>;
  if (!user) return <div className="text-sm text-gray-500">User not found.</div>;

  const fields = [
    { label: "Email", value: user.email, icon: Mail },
    { label: "Role", value: user.isSuperAdmin ? "super admin" : user.role, icon: Shield },
    { label: "Email verified", value: user.emailVerified ? "Yes" : "No", icon: Mail },
    { label: "Organization ID", value: user.organizationId ?? "—", icon: Building2 },
    { label: "Joined", value: new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }), icon: Calendar },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link href="/dashboard/users" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white mb-4 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Users
        </Link>
        <h1 className="text-xl font-bold text-white">{user.name || user.email}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{user.id}</p>
      </div>

      {impersonateToken && (
        <div className="p-4 rounded-xl bg-yellow-950 border border-yellow-800">
          <p className="text-yellow-400 text-sm font-semibold mb-1">Impersonation token (1h)</p>
          <code className="text-xs text-yellow-300 break-all">{impersonateToken}</code>
          <button onClick={() => setImpersonateToken(null)} className="ml-3 text-xs text-yellow-500 hover:text-yellow-300">Dismiss</button>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl divide-y divide-gray-800">
        {fields.map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex items-center justify-between px-5 py-3">
            <div className="flex items-center gap-2.5">
              <Icon className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-400">{label}</span>
            </div>
            <span className="text-sm text-white font-mono">{value}</span>
          </div>
        ))}
      </div>

      {sub && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-3">Subscription</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ["Tier", sub.tier],
              ["Status", sub.status],
              ["Provider", sub.billingProvider],
              ["Interval", sub.billingInterval],
              ["Period ends", sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : "—"],
            ].map(([k, v]) => (
              <div key={k}>
                <p className="text-xs text-gray-500">{k}</p>
                <p className="text-white capitalize">{v}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {!user.isSuperAdmin && user.organizationId && (
        <button
          onClick={handleImpersonate}
          disabled={impersonating}
          className="flex items-center gap-2 px-4 py-2.5 bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-medium rounded-xl disabled:opacity-50 transition-colors"
        >
          <UserCheck className="w-4 h-4" />
          {impersonating ? "Generating token…" : "Impersonate user"}
        </button>
      )}
    </div>
  );
}
