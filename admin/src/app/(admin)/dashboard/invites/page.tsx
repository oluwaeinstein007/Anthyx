"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  UserPlus, Copy, CheckCircle2, Clock, XCircle, Trash2,
  AlertCircle, RefreshCw,
} from "lucide-react";

const ADMIN_URL = process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3001";

type InviteRole = "owner" | "admin" | "support" | "billing";

const ROLE_LABELS: Record<InviteRole, { label: string; color: string }> = {
  owner:   { label: "Owner",   color: "bg-red-950 text-red-400" },
  admin:   { label: "Admin",   color: "bg-amber-950 text-amber-400" },
  support: { label: "Support", color: "bg-blue-950 text-blue-400" },
  billing: { label: "Billing", color: "bg-purple-950 text-purple-400" },
};

interface Invite {
  id: string;
  email: string;
  role: InviteRole;
  token: string;
  invitedByEmail: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  status: "pending" | "accepted" | "revoked" | "expired";
}

function StatusBadge({ status }: { status: Invite["status"] }) {
  const map = {
    pending:  "bg-green-950 text-green-400",
    accepted: "bg-gray-800 text-gray-400",
    revoked:  "bg-red-950 text-red-400",
    expired:  "bg-gray-800 text-gray-500",
  };
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full capitalize ${map[status]}`}>
      {status === "pending" && <Clock className="w-3 h-3" />}
      {status === "accepted" && <CheckCircle2 className="w-3 h-3" />}
      {status === "revoked" && <XCircle className="w-3 h-3" />}
      {status === "expired" && <AlertCircle className="w-3 h-3" />}
      {status}
    </span>
  );
}

export default function InvitesPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ email: "", role: "support" as InviteRole });
  const [createError, setCreateError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [newInviteLink, setNewInviteLink] = useState<string | null>(null);

  const { data: invites = [], isLoading } = useQuery<Invite[]>({
    queryKey: ["admin-invites"],
    queryFn: () => api.get<Invite[]>("/admin/invites"),
  });

  const create = useMutation({
    mutationFn: () => api.post<Invite>("/admin/invites", form),
    onSuccess: (inv) => {
      const link = `${ADMIN_URL}/accept-invite?token=${inv.token}`;
      setNewInviteLink(link);
      setForm({ email: "", role: "support" });
      setCreateError("");
      qc.invalidateQueries({ queryKey: ["admin-invites"] });
    },
    onError: (err) => setCreateError(err instanceof Error ? err.message : "Failed to create invite"),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/invites/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-invites"] }),
  });

  const copyLink = (token: string, id: string) => {
    const link = `${ADMIN_URL}/accept-invite?token=${token}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const pending = invites.filter((i) => i.status === "pending");
  const accepted = invites.filter((i) => i.status === "accepted");
  const others = invites.filter((i) => i.status === "revoked" || i.status === "expired");

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Team Invites</h1>
        <p className="text-sm text-gray-400 mt-1">
          Invite new admin-panel users. Each invite link is valid for 7 days.
        </p>
      </div>

      {/* Create invite */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-white">Send new invite</h2>

        {createError && (
          <div className="flex items-center gap-2 p-3 bg-red-950 border border-red-800 rounded-xl text-sm text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0" /> {createError}
          </div>
        )}

        {newInviteLink && (
          <div className="p-4 bg-green-950 border border-green-800 rounded-xl space-y-2">
            <p className="text-sm text-green-400 font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Invite created — share this link:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs text-green-300 bg-green-900/50 px-3 py-2 rounded-lg truncate">
                {newInviteLink}
              </code>
              <button
                onClick={() => { navigator.clipboard.writeText(newInviteLink); }}
                className="p-2 bg-green-800 hover:bg-green-700 rounded-lg text-green-300 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
            <button
              onClick={() => setNewInviteLink(null)}
              className="text-xs text-green-500 hover:text-green-400 transition-colors"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Email address *</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="admin@example.com"
              className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Role *</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as InviteRole })}
              className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="owner">Owner — full access</option>
              <option value="admin">Admin — manage orgs, users, billing</option>
              <option value="support">Support — read-only access</option>
              <option value="billing">Billing — billing & subscription access</option>
            </select>
          </div>
        </div>

        <button
          onClick={() => create.mutate()}
          disabled={!form.email || create.isPending}
          className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-900 disabled:text-red-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {create.isPending ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <UserPlus className="w-3.5 h-3.5" />
          )}
          {create.isPending ? "Creating…" : "Create invite link"}
        </button>
      </div>

      {/* Pending invites */}
      {isLoading ? (
        <div className="h-24 bg-gray-900 rounded-2xl animate-pulse" />
      ) : (
        <>
          {pending.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Pending ({pending.length})
              </h2>
              <div className="space-y-2">
                {pending.map((inv) => (
                  <InviteRow
                    key={inv.id} invite={inv} copiedId={copiedId}
                    onCopy={copyLink} onRevoke={(id) => revoke.mutate(id)}
                    isRevoking={revoke.isPending}
                  />
                ))}
              </div>
            </div>
          )}

          {accepted.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Accepted ({accepted.length})
              </h2>
              <div className="space-y-2">
                {accepted.map((inv) => (
                  <InviteRow key={inv.id} invite={inv} copiedId={copiedId} onCopy={copyLink} onRevoke={() => {}} isRevoking={false} />
                ))}
              </div>
            </div>
          )}

          {others.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Revoked / Expired ({others.length})
              </h2>
              <div className="space-y-2 opacity-60">
                {others.map((inv) => (
                  <InviteRow key={inv.id} invite={inv} copiedId={copiedId} onCopy={copyLink} onRevoke={() => {}} isRevoking={false} />
                ))}
              </div>
            </div>
          )}

          {invites.length === 0 && (
            <div className="text-center py-16 border border-dashed border-gray-800 rounded-2xl">
              <UserPlus className="w-8 h-8 text-gray-700 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No invites yet. Create one above.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function InviteRow({
  invite, copiedId, onCopy, onRevoke, isRevoking,
}: {
  invite: Invite;
  copiedId: string | null;
  onCopy: (token: string, id: string) => void;
  onRevoke: (id: string) => void;
  isRevoking: boolean;
}) {
  const roleInfo = ROLE_LABELS[invite.role] ?? { label: invite.role, color: "bg-gray-800 text-gray-400" };
  const isPending = invite.status === "pending";

  return (
    <div className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-white font-medium truncate">{invite.email}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${roleInfo.color}`}>{roleInfo.label}</span>
          <StatusBadge status={invite.status} />
        </div>
        <div className="text-xs text-gray-500 mt-0.5">
          Invited {new Date(invite.createdAt).toLocaleDateString()} by {invite.invitedByEmail ?? "unknown"}
          {isPending && ` · expires ${new Date(invite.expiresAt).toLocaleDateString()}`}
          {invite.acceptedAt && ` · accepted ${new Date(invite.acceptedAt).toLocaleDateString()}`}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {isPending && (
          <button
            onClick={() => onCopy(invite.token, invite.id)}
            title="Copy invite link"
            className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            {copiedId === invite.id ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        )}
        {isPending && (
          <button
            onClick={() => onRevoke(invite.id)}
            disabled={isRevoking}
            title="Revoke invite"
            className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-950 rounded-lg transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
