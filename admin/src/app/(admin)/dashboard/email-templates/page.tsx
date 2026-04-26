"use client";

import { useState } from "react";
import { Mail, Eye } from "lucide-react";

const TEMPLATES = [
  {
    id: "verify-email",
    name: "Email Verification",
    subject: "Verify your email — Anthyx",
    description: "Sent when a user registers. Contains the email verification link.",
    trigger: "On user registration",
    variables: ["{{name}}", "{{verifyUrl}}", "{{expiresIn}}"],
    preview: `Hi {{name}},\n\nWelcome to Anthyx! Please verify your email address:\n\n{{verifyUrl}}\n\nThis link expires in {{expiresIn}}.\n\nIf you didn't create an account, you can safely ignore this email.\n\nThe Anthyx team`,
  },
  {
    id: "password-reset",
    name: "Password Reset",
    subject: "Reset your Anthyx password",
    description: "Sent when a user requests a password reset.",
    trigger: "On password reset request",
    variables: ["{{name}}", "{{resetUrl}}", "{{expiresIn}}"],
    preview: `Hi {{name}},\n\nYou requested a password reset. Click the link below:\n\n{{resetUrl}}\n\nThis link expires in {{expiresIn}}. If you didn't request this, no action is needed.\n\nThe Anthyx team`,
  },
  {
    id: "trial-ending",
    name: "Trial Ending Soon",
    subject: "Your Anthyx trial ends in 3 days",
    description: "Sent 3 days before a trial subscription expires.",
    trigger: "3 days before trial end",
    variables: ["{{name}}", "{{trialEndDate}}", "{{upgradeUrl}}"],
    preview: `Hi {{name}},\n\nYour Anthyx trial ends on {{trialEndDate}}.\n\nUpgrade now to keep your agents running and never miss a post:\n\n{{upgradeUrl}}\n\nThe Anthyx team`,
  },
  {
    id: "payment-failed",
    name: "Payment Failed",
    subject: "Action required: payment failed for your Anthyx subscription",
    description: "Sent when a subscription payment fails.",
    trigger: "On invoice.payment_failed webhook",
    variables: ["{{name}}", "{{amount}}", "{{retryDate}}", "{{updatePaymentUrl}}"],
    preview: `Hi {{name}},\n\nWe couldn't process your payment of {{amount}}.\n\nPlease update your payment method:\n{{updatePaymentUrl}}\n\nWe'll retry on {{retryDate}}. If payment fails again, your account will be downgraded.\n\nThe Anthyx team`,
  },
  {
    id: "post-failed",
    name: "Post Failed Alert",
    subject: "Post failed to publish — action needed",
    description: "Sent when a scheduled post fails to publish.",
    trigger: "On post status = failed",
    variables: ["{{name}}", "{{platform}}", "{{postId}}", "{{error}}", "{{reviewUrl}}"],
    preview: `Hi {{name}},\n\nA scheduled post for {{platform}} failed to publish.\n\nPost ID: {{postId}}\nError: {{error}}\n\nReview the post:\n{{reviewUrl}}\n\nThe Anthyx team`,
  },
];

export default function EmailTemplatesPage() {
  const [selected, setSelected] = useState<typeof TEMPLATES[0] | null>(null);

  return (
    <div className="flex gap-6">
      <div className="w-72 shrink-0">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-white">Email Templates</h1>
          <p className="text-sm text-gray-500 mt-1">Transactional email templates</p>
        </div>

        <div className="space-y-1">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelected(t)}
              className={`w-full flex items-start gap-3 px-3 py-3 rounded-lg text-left transition-colors ${
                selected?.id === t.id
                  ? "bg-red-950 border border-red-800"
                  : "hover:bg-gray-900 border border-transparent"
              }`}
            >
              <Mail className={`w-4 h-4 mt-0.5 shrink-0 ${selected?.id === t.id ? "text-red-400" : "text-gray-500"}`} />
              <div>
                <p className={`text-sm font-medium ${selected?.id === t.id ? "text-red-300" : "text-gray-300"}`}>{t.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t.trigger}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        {selected ? (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold text-white">{selected.name}</h2>
              <p className="text-sm text-gray-500 mt-0.5">{selected.description}</p>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Subject line</p>
                <p className="text-sm text-white">{selected.subject}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Trigger</p>
                <p className="text-sm text-gray-300">{selected.trigger}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Variables</p>
                <div className="flex flex-wrap gap-1.5">
                  {selected.variables.map((v) => (
                    <code key={v} className="text-xs px-2 py-0.5 bg-gray-800 text-green-400 rounded font-mono">{v}</code>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
                <Eye className="w-3.5 h-3.5 text-gray-500" />
                <p className="text-xs font-medium text-gray-400">Plain text preview</p>
              </div>
              <pre className="px-5 py-4 text-sm text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
                {selected.preview}
              </pre>
            </div>

            <p className="text-xs text-gray-600">
              Templates are rendered server-side using the variables above. To customize, edit the template files in
              <code className="ml-1 text-gray-500">api/src/services/email/</code>.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center mb-3">
              <Mail className="w-6 h-6 text-gray-600" />
            </div>
            <p className="text-sm text-gray-500">Select a template to preview</p>
          </div>
        )}
      </div>
    </div>
  );
}
