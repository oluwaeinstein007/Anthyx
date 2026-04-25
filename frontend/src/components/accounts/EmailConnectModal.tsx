"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { X, Info } from "lucide-react";

type Mailer = "smtp" | "sendgrid" | "mailgun";

interface ExistingEmailConfig {
  id: string;
  accountHandle: string;
  platformConfig: {
    mailer?: string;
    fromAddress?: string;
    fromName?: string;
    host?: string;
    port?: number;
    username?: string;
    encryption?: string;
    domain?: string;
    recipients?: string[];
  };
}

interface Props {
  onClose: () => void;
  existing?: ExistingEmailConfig;
}

const MAILERS: { id: Mailer; label: string }[] = [
  { id: "smtp", label: "SMTP" },
  { id: "sendgrid", label: "SendGrid" },
  { id: "mailgun", label: "Mailgun" },
];

export function EmailConnectModal({ onClose, existing }: Props) {
  const qc = useQueryClient();
  const isEdit = !!existing;
  const prevCfg = existing?.platformConfig ?? {};

  const [mailer, setMailer] = useState<Mailer>((prevCfg.mailer as Mailer) ?? "smtp");
  const [displayName, setDisplayName] = useState(existing?.accountHandle ?? "");
  const [fromAddress, setFromAddress] = useState(prevCfg.fromAddress ?? "");
  const [fromName, setFromName] = useState(prevCfg.fromName ?? "");
  const [recipients, setRecipients] = useState(prevCfg.recipients?.join(", ") ?? "");

  // SMTP
  const [host, setHost] = useState(prevCfg.host ?? "");
  const [port, setPort] = useState(String(prevCfg.port ?? "587"));
  const [username, setUsername] = useState(prevCfg.username ?? "");
  const [password, setPassword] = useState("");
  const [encryption, setEncryption] = useState(prevCfg.encryption ?? "tls");

  // SendGrid
  const [apiKey, setApiKey] = useState("");

  // Mailgun
  const [mailgunApiKey, setMailgunApiKey] = useState("");
  const [mailgunDomain, setMailgunDomain] = useState(prevCfg.domain ?? "");

  const canSubmit = (() => {
    if (!fromAddress.trim()) return false;
    if (mailer === "smtp") {
      if (!isEdit) return !!(host.trim() && username.trim() && password.trim());
      return !!(host.trim() && username.trim()); // password optional on edit
    }
    if (mailer === "sendgrid") return isEdit ? true : !!apiKey.trim();
    if (mailer === "mailgun") {
      if (!isEdit) return !!(mailgunApiKey.trim() && mailgunDomain.trim());
      return !!mailgunDomain.trim();
    }
    return false;
  })();

  const mutation = useMutation({
    mutationFn: () => {
      const body: Record<string, string> = {
        mailer,
        fromAddress: fromAddress.trim(),
        fromName: fromName.trim(),
        recipients: recipients.trim(),
        displayName: displayName.trim(),
      };
      if (mailer === "smtp") {
        body["host"] = host.trim();
        body["port"] = port.trim();
        body["username"] = username.trim();
        body["encryption"] = encryption;
        if (password.trim()) body["password"] = password.trim();
      } else if (mailer === "sendgrid") {
        if (apiKey.trim()) body["apiKey"] = apiKey.trim();
      } else if (mailer === "mailgun") {
        body["mailgunDomain"] = mailgunDomain.trim();
        if (mailgunApiKey.trim()) body["mailgunApiKey"] = mailgunApiKey.trim();
      }

      return isEdit
        ? api.put(`/accounts/email/${existing!.id}`, body)
        : api.post("/accounts/email", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      onClose();
    },
  });

  const inputCls =
    "w-full rounded-xl border border-gray-200 text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-amber-50">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                {isEdit ? "Edit Email Account" : "Connect Email"}
              </h2>
              <p className="text-xs text-gray-500">
                {isEdit ? "Update credentials or recipients" : "Configure your mail provider"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Mailer selector */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Mail Provider</label>
            <div className="flex gap-2">
              {MAILERS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMailer(m.id)}
                  className={`flex-1 py-2 text-xs font-medium rounded-xl border transition-colors ${
                    mailer === m.id
                      ? "bg-amber-500 border-amber-500 text-white"
                      : "border-gray-200 text-gray-600 hover:border-gray-300 bg-white"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-gray-100" />

          {/* Sender info — always visible */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sender</p>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">From Address <span className="text-red-400">*</span></label>
              <input className={inputCls} type="email" placeholder="hello@yourbrand.com" value={fromAddress} onChange={(e) => setFromAddress(e.target.value)} autoComplete="off" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">From Name (optional)</label>
              <input className={inputCls} type="text" placeholder="Your Brand" value={fromName} onChange={(e) => setFromName(e.target.value)} autoComplete="off" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">List Name (optional)</label>
              <input className={inputCls} type="text" placeholder="Newsletter subscribers" value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="off" />
              <p className="text-xs text-gray-400 mt-1">A label shown in the dashboard</p>
            </div>
          </div>

          <div className="border-t border-gray-100" />

          {/* Mailer-specific credentials */}
          {mailer === "smtp" && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">SMTP Credentials</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Host <span className="text-red-400">*</span></label>
                  <input className={inputCls} placeholder="smtp.gmail.com" value={host} onChange={(e) => setHost(e.target.value)} autoComplete="off" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Port</label>
                  <input className={inputCls} placeholder="587" value={port} onChange={(e) => setPort(e.target.value)} autoComplete="off" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Security</label>
                <select className={inputCls} value={encryption} onChange={(e) => setEncryption(e.target.value)}>
                  <option value="tls">TLS (port 587)</option>
                  <option value="ssl">SSL (port 465)</option>
                  <option value="none">None (port 25)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Username <span className="text-red-400">*</span></label>
                <input className={inputCls} placeholder="you@gmail.com" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Password {isEdit && <span className="text-gray-400 font-normal">(leave blank to keep current)</span>}
                  {!isEdit && <span className="text-red-400"> *</span>}
                </label>
                <input className={`${inputCls} font-mono`} type="password" placeholder={isEdit ? "••••••••" : "your SMTP password or app password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
              </div>
              <div className="flex gap-2.5 p-3 bg-blue-50 rounded-xl border border-blue-100">
                <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800 leading-relaxed">
                  For Gmail, use an <strong>App Password</strong> — not your account password. Create one at myaccount.google.com → Security → App passwords.
                </p>
              </div>
            </div>
          )}

          {mailer === "sendgrid" && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">SendGrid Credentials</p>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  API Key {isEdit && <span className="text-gray-400 font-normal">(leave blank to keep current)</span>}
                  {!isEdit && <span className="text-red-400"> *</span>}
                </label>
                <input className={`${inputCls} font-mono`} type="password" placeholder="SG.xxxxxxxxxxxxxxxx" value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="off" />
                <p className="text-xs text-gray-400 mt-1">From SendGrid Dashboard → Settings → API Keys. Needs "Mail Send" permission.</p>
              </div>
            </div>
          )}

          {mailer === "mailgun" && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Mailgun Credentials</p>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Sending Domain <span className="text-red-400">*</span></label>
                <input className={inputCls} placeholder="mg.yourdomain.com" value={mailgunDomain} onChange={(e) => setMailgunDomain(e.target.value)} autoComplete="off" />
                <p className="text-xs text-gray-400 mt-1">Your verified Mailgun domain.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  API Key {isEdit && <span className="text-gray-400 font-normal">(leave blank to keep current)</span>}
                  {!isEdit && <span className="text-red-400"> *</span>}
                </label>
                <input className={`${inputCls} font-mono`} type="password" placeholder="key-xxxxxxxxxxxxxxxx" value={mailgunApiKey} onChange={(e) => setMailgunApiKey(e.target.value)} autoComplete="off" />
                <p className="text-xs text-gray-400 mt-1">From Mailgun Dashboard → API Keys → Private API key.</p>
              </div>
            </div>
          )}

          <div className="border-t border-gray-100" />

          {/* Recipients */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Recipients <span className="text-gray-400 font-normal">(optional — can be added after connecting)</span>
            </label>
            <textarea
              className={`${inputCls} h-24 resize-none font-mono text-xs`}
              placeholder={"alice@example.com, bob@example.com,\ncarol@example.com"}
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">Comma or newline separated. Each recipient gets a separate email.</p>
          </div>

          {mutation.isError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              {mutation.error instanceof Error ? mutation.error.message : "Connection failed"}
            </p>
          )}

          <div className="flex justify-end gap-2.5 pt-1">
            <button onClick={onClose} className="px-4 py-2 text-sm rounded-xl text-gray-600 hover:bg-gray-100 transition-colors">
              Cancel
            </button>
            <button
              onClick={() => mutation.mutate()}
              disabled={!canSubmit || mutation.isPending}
              className="px-4 py-2 text-sm rounded-xl text-white font-medium disabled:opacity-50 transition-colors bg-amber-600 hover:bg-amber-700"
            >
              {mutation.isPending ? (isEdit ? "Saving…" : "Connecting…") : (isEdit ? "Save Changes" : "Connect Email")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
