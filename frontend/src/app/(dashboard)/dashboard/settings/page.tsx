"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { User, Lock, Check } from "lucide-react";

interface Me {
  id: string;
  email: string;
  name: string;
}

const INPUT = "w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent";

export default function SettingsPage() {
  const qc = useQueryClient();

  const { data: me } = useQuery<Me>({
    queryKey: ["me"],
    queryFn: () => api.get<Me>("/auth/me"),
  });

  const [name, setName] = useState("");
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState("");

  useEffect(() => {
    if (me?.name && !name) setName(me.name);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.name]);

  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const updateProfile = useMutation({
    mutationFn: () => api.put("/auth/me", { name: name.trim() }),
    onSuccess: () => {
      setProfileSuccess(true);
      setProfileError("");
      qc.invalidateQueries({ queryKey: ["me"] });
      setTimeout(() => setProfileSuccess(false), 3000);
    },
    onError: (err) => {
      setProfileError(err instanceof Error ? err.message : "Failed to update profile");
    },
  });

  const changePassword = useMutation({
    mutationFn: () =>
      api.put("/auth/password", {
        currentPassword: passwords.current,
        newPassword: passwords.next,
      }),
    onSuccess: () => {
      setPasswordSuccess(true);
      setPasswordError("");
      setPasswords({ current: "", next: "", confirm: "" });
      setTimeout(() => setPasswordSuccess(false), 3000);
    },
    onError: (err) => {
      setPasswordError(err instanceof Error ? err.message : "Failed to change password");
    },
  });

  function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError("");
    if (passwords.next !== passwords.confirm) {
      setPasswordError("New passwords do not match");
      return;
    }
    if (passwords.next.length < 8) {
      setPasswordError("New password must be at least 8 characters");
      return;
    }
    changePassword.mutate();
  }

  return (
    <div className="space-y-8 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your account details and security.</p>
      </div>

      {/* Profile */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <User className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-900">Profile</h2>
        </div>

        {profileError && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            {profileError}
          </div>
        )}
        {profileSuccess && (
          <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm flex items-center gap-2">
            <Check className="w-4 h-4" /> Profile updated.
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Display name</label>
          <input
            className={INPUT}
            placeholder="Your display name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Email</label>
          <input
            className={`${INPUT} bg-gray-50 text-gray-400 cursor-not-allowed`}
            value={me?.email ?? ""}
            disabled
          />
          <p className="text-xs text-gray-400 mt-1">Email cannot be changed.</p>
        </div>

        <button
          onClick={() => updateProfile.mutate()}
          disabled={updateProfile.isPending || !name.trim()}
          className="px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-sm font-medium rounded-xl transition-colors"
        >
          {updateProfile.isPending ? "Saving…" : "Save changes"}
        </button>
      </div>

      {/* Change password */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Lock className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-900">Change password</h2>
        </div>

        {passwordError && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            {passwordError}
          </div>
        )}
        {passwordSuccess && (
          <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm flex items-center gap-2">
            <Check className="w-4 h-4" /> Password changed.
          </div>
        )}

        <form onSubmit={submitPassword} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Current password</label>
            <input
              type="password"
              className={INPUT}
              placeholder="Enter current password"
              value={passwords.current}
              onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">New password</label>
            <input
              type="password"
              className={INPUT}
              placeholder="8+ characters"
              value={passwords.next}
              onChange={(e) => setPasswords({ ...passwords, next: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Confirm new password</label>
            <input
              type="password"
              className={INPUT}
              placeholder="Repeat new password"
              value={passwords.confirm}
              onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
              required
            />
          </div>
          <button
            type="submit"
            disabled={changePassword.isPending}
            className="px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {changePassword.isPending ? "Updating…" : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}
