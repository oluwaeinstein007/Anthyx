"use client";

import { useState } from "react";
import { Settings, Save, Eye, EyeOff } from "lucide-react";

interface SettingField {
  key: string;
  label: string;
  description: string;
  type: "text" | "secret" | "toggle";
  envVar: string;
  placeholder?: string;
}

const SETTING_GROUPS: Array<{ group: string; fields: SettingField[] }> = [
  {
    group: "Email",
    fields: [
      { key: "SMTP_HOST", label: "SMTP Host", description: "SMTP server hostname", type: "text", envVar: "SMTP_HOST", placeholder: "smtp.sendgrid.net" },
      { key: "SMTP_PORT", label: "SMTP Port", description: "SMTP server port", type: "text", envVar: "SMTP_PORT", placeholder: "587" },
      { key: "SMTP_USER", label: "SMTP User", description: "SMTP authentication username", type: "text", envVar: "SMTP_USER", placeholder: "apikey" },
      { key: "SMTP_PASS", label: "SMTP Password", description: "SMTP authentication password", type: "secret", envVar: "SMTP_PASS", placeholder: "••••••••" },
      { key: "FROM_EMAIL", label: "From Email", description: "Default sender address", type: "text", envVar: "FROM_EMAIL", placeholder: "noreply@anthyx.io" },
    ],
  },
  {
    group: "Billing",
    fields: [
      { key: "STRIPE_SK", label: "Stripe Secret Key", description: "Stripe API secret key", type: "secret", envVar: "STRIPE_SECRET_KEY", placeholder: "sk_live_…" },
      { key: "STRIPE_WH", label: "Stripe Webhook Secret", description: "Webhook endpoint signing secret", type: "secret", envVar: "STRIPE_WEBHOOK_SECRET", placeholder: "whsec_…" },
      { key: "PAYSTACK_SK", label: "Paystack Secret Key", description: "Paystack API secret key", type: "secret", envVar: "PAYSTACK_SECRET_KEY", placeholder: "sk_live_…" },
    ],
  },
  {
    group: "AI",
    fields: [
      { key: "ANTHROPIC_KEY", label: "Anthropic API Key", description: "Claude API key for agent pipeline", type: "secret", envVar: "ANTHROPIC_API_KEY", placeholder: "sk-ant-…" },
      { key: "OPENAI_KEY", label: "OpenAI API Key", description: "Used for image generation (DALL-E)", type: "secret", envVar: "OPENAI_API_KEY", placeholder: "sk-…" },
    ],
  },
];

export default function AdminSettingsPage() {
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  const toggleSecret = (key: string) =>
    setShowSecrets((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-white">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Platform configuration reference</p>
      </div>

      <div className="mb-6 p-4 bg-yellow-950 border border-yellow-800 rounded-xl text-sm text-yellow-400">
        <strong>Note:</strong> These settings are managed via environment variables on the API server. This page provides a reference for the required configuration. To change values, update your deployment environment variables and restart the service.
      </div>

      <div className="space-y-6">
        {SETTING_GROUPS.map(({ group, fields }) => (
          <div key={group} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-800">
              <h2 className="text-sm font-semibold text-white">{group}</h2>
            </div>
            <div className="divide-y divide-gray-800">
              {fields.map((field) => (
                <div key={field.key} className="flex items-center justify-between px-5 py-4 gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-200">{field.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{field.description}</p>
                    <code className="text-xs text-gray-600 mt-1 block">{field.envVar}</code>
                  </div>
                  {field.type === "secret" ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-mono text-gray-500">
                        {showSecrets[field.key] ? "Set in environment" : "••••••••"}
                      </span>
                      <button
                        onClick={() => toggleSecret(field.key)}
                        className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        {showSecrets[field.key] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-500 shrink-0">{field.placeholder}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
