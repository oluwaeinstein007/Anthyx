"use client";

import { BookOpen, Copy, Check, ExternalLink, FileText, Image, MessageSquare } from "lucide-react";
import { useState } from "react";

const COPY_SNIPPETS = [
  {
    label: "Twitter/X bio CTA",
    text: "📈 I use Anthyx to automate my brand's social content with AI. Start your free trial →",
  },
  {
    label: "LinkedIn post opener",
    text: "I've been using Anthyx to run my brand's social media on autopilot. The 3-agent AI pipeline handles everything from strategy to review — here's what I've learned:",
  },
  {
    label: "Email newsletter blurb",
    text: "One tool I've been recommending lately: Anthyx. It uses a multi-agent AI pipeline to plan, write, and post content across all major platforms — and keeps you in the loop with a human review step before anything goes live.",
  },
];

const BANNER_SIZES = [
  { label: "Leaderboard (728×90)", dims: "728 × 90" },
  { label: "Rectangle (300×250)", dims: "300 × 250" },
  { label: "Half page (300×600)", dims: "300 × 600" },
  { label: "Square (250×250)", dims: "250 × 250" },
];

const GUIDES = [
  { title: "Getting started as an affiliate", href: "#" },
  { title: "How to share your tracking link", href: "#" },
  { title: "When and how commissions are paid", href: "#" },
  { title: "Promotional guidelines (what you can and can't say)", href: "#" },
  { title: "Affiliate program terms and conditions", href: "#" },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

export default function ResourcesPage() {
  return (
    <div className="space-y-10 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-white">Resources</h1>
        <p className="text-sm text-gray-500 mt-1">Marketing assets and copy for your promotions</p>
      </div>

      {/* Copy snippets */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="w-4 h-4 text-purple-400" />
          <h2 className="text-sm font-semibold text-white">Ready-to-use copy</h2>
        </div>
        <div className="space-y-3">
          {COPY_SNIPPETS.map((s) => (
            <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-400">{s.label}</p>
                <CopyButton text={s.text} />
              </div>
              <p className="text-sm text-gray-300 leading-relaxed">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Banner ads */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Image className="w-4 h-4 text-purple-400" />
          <h2 className="text-sm font-semibold text-white">Banner ads</h2>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800">
            <p className="text-xs text-gray-500">
              Download pre-made banner ads in common sizes. Use them on your website or in display campaigns.
            </p>
          </div>
          <div className="divide-y divide-gray-800">
            {BANNER_SIZES.map((b) => (
              <div key={b.label} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm text-gray-200">{b.label}</p>
                  <p className="text-xs text-gray-500">{b.dims}px</p>
                </div>
                <button className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
                  Download
                </button>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-gray-600 mt-2">Banner assets will be provided by the team once your account is approved.</p>
      </section>

      {/* Guides */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-4 h-4 text-purple-400" />
          <h2 className="text-sm font-semibold text-white">Guides &amp; policies</h2>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden divide-y divide-gray-800">
          {GUIDES.map((g) => (
            <a
              key={g.title}
              href={g.href}
              className="flex items-center justify-between px-5 py-3 text-sm text-gray-300 hover:text-white hover:bg-gray-800 transition-colors group"
            >
              {g.title}
              <ExternalLink className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-400 transition-colors" />
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
