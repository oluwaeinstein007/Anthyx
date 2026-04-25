"use client";

import { useEffect, useState } from "react";
import { Search, UserCheck } from "lucide-react";
import { api } from "@/lib/api";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  isSuperAdmin: boolean;
  emailVerified: boolean;
  createdAt: string;
  organizationId: string | null;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [impersonating, setImpersonating] = useState<string | null>(null);
  const [impersonateResult, setImpersonateResult] = useState<{ token: string; userId: string } | null>(null);

  useEffect(() => {
    api.get<User[]>("/admin/users")
      .then(setUsers)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = users.filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.name.toLowerCase().includes(search.toLowerCase()),
  );

  async function handleImpersonate(userId: string) {
    setImpersonating(userId);
    try {
      const res = await api.post<{ token: string; expiresIn: string }>(`/admin/users/${userId}/impersonate`);
      setImpersonateResult({ token: res.token, userId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impersonation failed");
    } finally {
      setImpersonating(null);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-bold text-white">Users</h1>
        <p className="text-sm text-gray-500 mt-1">{users.length} total</p>
      </div>

      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm pl-9 pr-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
        />
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-950 border border-red-800 text-red-400 text-sm">{error}</div>}

      {impersonateResult && (
        <div className="mb-4 p-4 rounded-lg bg-yellow-950 border border-yellow-800">
          <p className="text-yellow-400 text-sm font-semibold mb-1">Impersonation token (1h)</p>
          <code className="text-xs text-yellow-300 break-all">{impersonateResult.token}</code>
          <button onClick={() => setImpersonateResult(null)} className="ml-3 text-xs text-yellow-500 hover:text-yellow-300">Dismiss</button>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">No users found</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">User</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Role</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Joined</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr key={user.id} className="border-b border-gray-800 last:border-0">
                  <td className="px-5 py-3">
                    <p className="font-medium text-white">{user.name}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      user.isSuperAdmin ? "bg-red-900/50 text-red-400" :
                      user.role === "owner" ? "bg-purple-900/50 text-purple-400" :
                      "bg-gray-800 text-gray-400"
                    }`}>
                      {user.isSuperAdmin ? "super admin" : user.role}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      user.emailVerified ? "bg-green-900/50 text-green-400" : "bg-gray-800 text-gray-400"
                    }`}>
                      {user.emailVerified ? "verified" : "unverified"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-400">{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td className="px-5 py-3 text-right">
                    {!user.isSuperAdmin && user.organizationId && (
                      <button
                        onClick={() => handleImpersonate(user.id)}
                        disabled={impersonating === user.id}
                        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors ml-auto"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        {impersonating === user.id ? "…" : "Impersonate"}
                      </button>
                    )}
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
