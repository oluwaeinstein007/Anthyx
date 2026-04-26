"use client";

import { useState } from "react";
import { HeadphonesIcon, ExternalLink, BookOpen, MessageSquare, GitBranch, Mail } from "lucide-react";

const RESOURCES = [
  {
    title: "API Documentation",
    description: "Full API reference for all endpoints.",
    icon: BookOpen,
    href: "/docs/api",
    external: false,
  },
  {
    title: "GitHub Issues",
    description: "Track bugs and feature requests.",
    icon: GitBranch,
    href: "https://github.com/your-org/anthyx/issues",
    external: true,
  },
  {
    title: "Contact Engineering",
    description: "Email the team for escalations.",
    icon: Mail,
    href: "mailto:engineering@anthyx.io",
    external: true,
  },
];

const COMMON_ISSUES = [
  {
    q: "A user's posts are stuck in 'approved' status",
    a: "The user has approved posts but hasn't connected a social account for that platform. They need to connect an account from /dashboard/accounts before posts can be scheduled.",
  },
  {
    q: "An organization's subscription shows the wrong tier",
    a: "Navigate to Organizations → select the org → update the tier using the override button. If using Stripe, the webhook may have failed — check the webhook logs.",
  },
  {
    q: "A feature flag isn't taking effect",
    a: "Feature flags are checked at API request time. After toggling, the next API call from that org will pick up the change. No cache invalidation is needed.",
  },
  {
    q: "An agent keeps getting silenced",
    a: "Check the agent logs for the reason. Common causes: expired OAuth token (the user needs to reconnect the account), guardrail violations, or an active blackout period.",
  },
  {
    q: "A promo code isn't applying",
    a: "Check the code is active, hasn't expired, hasn't exceeded maxUses, and applies to the tier the user is trying to subscribe to.",
  },
];

export default function SupportPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-white">Support</h1>
        <p className="text-sm text-gray-500 mt-1">Admin runbook and escalation resources</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        {RESOURCES.map((r) => (
          <a
            key={r.title}
            href={r.href}
            target={r.external ? "_blank" : undefined}
            rel={r.external ? "noopener noreferrer" : undefined}
            className="flex flex-col gap-2 p-4 bg-gray-900 border border-gray-800 rounded-xl hover:border-gray-700 transition-colors group"
          >
            <div className="flex items-center justify-between">
              <r.icon className="w-4 h-4 text-gray-500" />
              {r.external && <ExternalLink className="w-3 h-3 text-gray-600 group-hover:text-gray-400 transition-colors" />}
            </div>
            <p className="text-sm font-medium text-white">{r.title}</p>
            <p className="text-xs text-gray-500">{r.description}</p>
          </a>
        ))}
      </div>

      <div className="mb-4">
        <h2 className="text-base font-semibold text-white flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-gray-500" />
          Common issues
        </h2>
      </div>

      <div className="space-y-2">
        {COMMON_ISSUES.map((item, i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <button
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-medium text-gray-200 hover:text-white transition-colors"
            >
              {item.q}
              <span className="text-gray-500 ml-4 shrink-0">{openIndex === i ? "−" : "+"}</span>
            </button>
            {openIndex === i && (
              <div className="px-5 pb-4 text-sm text-gray-400 border-t border-gray-800 pt-3">
                {item.a}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
