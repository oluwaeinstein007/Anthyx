"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { X, ExternalLink } from "lucide-react";

interface Field {
  key: string;
  label: string;
  placeholder: string;
  type?: "text" | "password";
  hint?: string;
}

interface Step {
  n: number;
  text: React.ReactNode;
}

interface Props {
  platform: string;
  label: string;
  accentColor: string;       // Tailwind bg class for the icon dot
  accentRing: string;        // Tailwind focus ring class for inputs
  accentBtn: string;         // Tailwind bg + hover class for submit button
  endpoint: string;          // e.g. "/accounts/discord"
  fields: Field[];
  steps: Step[];
  onClose: () => void;
}

export function TokenConnectModal({
  label, accentColor, accentRing, accentBtn,
  endpoint, fields, steps, onClose,
}: Props) {
  const qc = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, ""])),
  );

  const connect = useMutation({
    mutationFn: () => api.post(endpoint, values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      onClose();
    },
  });

  const canSubmit = fields.every((f) => values[f.key]?.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${accentColor.replace("bg-", "bg-").replace("-500", "-50").replace("-600", "-50").replace("-400", "-50")}`}>
              <div className={`w-2.5 h-2.5 rounded-full ${accentColor}`} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Connect {label}</h2>
              <p className="text-xs text-gray-500">Manual token setup</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {steps.length > 0 && (
            <div className="space-y-3">
              {steps.map(({ n, text }) => (
                <div key={n} className="flex gap-3">
                  <span className={`shrink-0 w-5 h-5 rounded-full text-white text-xs font-bold flex items-center justify-center mt-0.5 ${accentBtn.split(" ")[0]}`}>
                    {n}
                  </span>
                  <p className="text-sm text-gray-600 leading-relaxed">{text}</p>
                </div>
              ))}
            </div>
          )}

          {steps.length > 0 && <div className="border-t border-gray-100" />}

          <div className="space-y-3">
            {fields.map((f) => (
              <div key={f.key}>
                <label className="block text-xs font-medium text-gray-700 mb-1">{f.label}</label>
                <input
                  type={f.type ?? "text"}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  autoComplete="off"
                  className={`w-full rounded-xl border border-gray-200 text-sm px-3 py-2.5 focus:outline-none focus:ring-2 ${accentRing} focus:border-transparent font-mono`}
                />
                {f.hint && <p className="text-xs text-gray-400 mt-1">{f.hint}</p>}
              </div>
            ))}
          </div>

          {connect.isError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              {connect.error instanceof Error ? connect.error.message : "Connection failed"}
            </p>
          )}

          <div className="flex justify-end gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-xl text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => connect.mutate()}
              disabled={!canSubmit || connect.isPending}
              className={`px-4 py-2 text-sm rounded-xl text-white font-medium disabled:opacity-50 transition-colors ${accentBtn}`}
            >
              {connect.isPending ? "Connecting…" : `Connect ${label}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Pre-configured modals for each manual-token platform ──────────────────────

export function DiscordConnectModal({ onClose }: { onClose: () => void }) {
  return (
    <TokenConnectModal
      platform="discord"
      label="Discord"
      accentColor="bg-indigo-500"
      accentRing="focus:ring-indigo-400"
      accentBtn="bg-indigo-600 hover:bg-indigo-700"
      endpoint="/accounts/discord"
      fields={[
        { key: "botToken", label: "Bot Token", placeholder: "MTIz...", type: "password",
          hint: "From the Discord Developer Portal → Your App → Bot → Token" },
        { key: "channelId", label: "Channel ID", placeholder: "1234567890123456789",
          hint: "Right-click the channel in Discord → Copy Channel ID (requires Developer Mode)" },
      ]}
      steps={[
        { n: 1, text: <><a href="https://discord.com/developers/applications" target="_blank" rel="noreferrer" className="text-indigo-600 underline inline-flex items-center gap-0.5">Discord Developer Portal <ExternalLink className="w-3 h-3" /></a> → New Application → Bot → <strong>Reset Token</strong> and copy it.</> },
        { n: 2, text: <>Under <strong>OAuth2 → URL Generator</strong>, add the <code className="bg-gray-100 px-1 rounded text-xs">bot</code> scope with <strong>Send Messages</strong> permission, generate the URL, and invite the bot to your server.</> },
        { n: 3, text: <>Enable <strong>Developer Mode</strong> in Discord (Settings → Advanced), then right-click your target channel and copy the Channel ID.</> },
      ]}
      onClose={onClose}
    />
  );
}

export function SlackConnectModal({ onClose }: { onClose: () => void }) {
  return (
    <TokenConnectModal
      platform="slack"
      label="Slack"
      accentColor="bg-purple-500"
      accentRing="focus:ring-purple-400"
      accentBtn="bg-purple-600 hover:bg-purple-700"
      endpoint="/accounts/slack"
      fields={[
        { key: "botToken", label: "Bot OAuth Token", placeholder: "xoxb-...", type: "password",
          hint: "From api.slack.com → Your App → OAuth & Permissions → Bot User OAuth Token" },
        { key: "channelId", label: "Channel ID", placeholder: "C1234567890",
          hint: "Open the channel in Slack → right-click → Copy → Copy Link — the ID is at the end of the URL" },
      ]}
      steps={[
        { n: 1, text: <><a href="https://api.slack.com/apps" target="_blank" rel="noreferrer" className="text-purple-600 underline inline-flex items-center gap-0.5">api.slack.com/apps <ExternalLink className="w-3 h-3" /></a> → Create New App → From Scratch.</> },
        { n: 2, text: <>Go to <strong>OAuth & Permissions</strong>, add scopes: <code className="bg-gray-100 px-1 rounded text-xs">chat:write</code>, <code className="bg-gray-100 px-1 rounded text-xs">channels:read</code>. Then click <strong>Install to Workspace</strong> and copy the <strong>Bot User OAuth Token</strong>.</> },
        { n: 3, text: <>Invite the bot to your channel: <code className="bg-gray-100 px-1 rounded text-xs">/invite @your-bot-name</code>. Then copy the channel ID from the channel URL.</> },
      ]}
      onClose={onClose}
    />
  );
}

export function WhatsAppConnectModal({ onClose }: { onClose: () => void }) {
  return (
    <TokenConnectModal
      platform="whatsapp"
      label="WhatsApp"
      accentColor="bg-green-500"
      accentRing="focus:ring-green-400"
      accentBtn="bg-green-600 hover:bg-green-700"
      endpoint="/accounts/whatsapp"
      fields={[
        { key: "accessToken", label: "System User Access Token", placeholder: "EAAx...", type: "password",
          hint: "From Meta Business Suite → WhatsApp → API Setup → Permanent token" },
        { key: "phoneNumberId", label: "Phone Number ID", placeholder: "1234567890",
          hint: "From Meta WhatsApp API Setup page — not the phone number itself, but the numeric ID" },
        { key: "displayName", label: "Display Name (optional)", placeholder: "My Brand WA",
          hint: "A label to identify this account in the dashboard" },
      ]}
      steps={[
        { n: 1, text: <><a href="https://developers.facebook.com" target="_blank" rel="noreferrer" className="text-green-600 underline inline-flex items-center gap-0.5">Meta Developer Portal <ExternalLink className="w-3 h-3" /></a> → Create App → Business → Add WhatsApp product.</> },
        { n: 2, text: <>In <strong>WhatsApp → API Setup</strong>, copy the <strong>Phone Number ID</strong> and generate a <strong>Permanent System User Access Token</strong>.</> },
        { n: 3, text: <>Ensure your WhatsApp Business Account is verified and the number has been approved for messaging.</> },
      ]}
      onClose={onClose}
    />
  );
}

export function BlueskyConnectModal({ onClose }: { onClose: () => void }) {
  return (
    <TokenConnectModal
      platform="bluesky"
      label="Bluesky"
      accentColor="bg-sky-500"
      accentRing="focus:ring-sky-400"
      accentBtn="bg-sky-600 hover:bg-sky-700"
      endpoint="/accounts/bluesky"
      fields={[
        { key: "identifier", label: "Handle or Email", placeholder: "yourhandle.bsky.social",
          hint: "Your Bluesky handle (e.g. @you.bsky.social) or the email used to sign up" },
        { key: "appPassword", label: "App Password", placeholder: "xxxx-xxxx-xxxx-xxxx", type: "password",
          hint: "Settings → Privacy and Security → App Passwords → Add App Password. Do NOT use your main password." },
      ]}
      steps={[
        { n: 1, text: <>Open <a href="https://bsky.app" target="_blank" rel="noreferrer" className="text-sky-600 underline inline-flex items-center gap-0.5">bsky.app <ExternalLink className="w-3 h-3" /></a> → Settings → <strong>Privacy and Security</strong> → <strong>App Passwords</strong>.</> },
        { n: 2, text: <>Click <strong>Add App Password</strong>, name it (e.g. "Anthyx"), and copy the generated password.</> },
      ]}
      onClose={onClose}
    />
  );
}

export function MastodonConnectModal({ onClose }: { onClose: () => void }) {
  return (
    <TokenConnectModal
      platform="mastodon"
      label="Mastodon"
      accentColor="bg-violet-500"
      accentRing="focus:ring-violet-400"
      accentBtn="bg-violet-600 hover:bg-violet-700"
      endpoint="/accounts/mastodon"
      fields={[
        { key: "instanceUrl", label: "Instance URL", placeholder: "mastodon.social",
          hint: "Just the domain — no https:// needed" },
        { key: "accessToken", label: "Access Token", placeholder: "your-token", type: "password",
          hint: "From your instance: Settings → Development → New Application → Access Token" },
      ]}
      steps={[
        { n: 1, text: <>Log in to your Mastodon instance and go to <strong>Settings → Development → Your Applications</strong> → New Application.</> },
        { n: 2, text: <>Grant scopes: <code className="bg-gray-100 px-1 rounded text-xs">read</code> and <code className="bg-gray-100 px-1 rounded text-xs">write:statuses</code>. Submit, then click your app and copy the <strong>Your access token</strong>.</> },
      ]}
      onClose={onClose}
    />
  );
}
