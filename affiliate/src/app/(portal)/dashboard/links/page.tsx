"use client";

import { useEffect, useState } from "react";
import { Plus, Copy, Check } from "lucide-react";
import { api } from "@/lib/api";

interface AffiliateLink {
  id: string;
  code: string;
  campaign: string | null;
  clicks: number;
  conversions: number;
  createdAt: string;
}

const BASE_URL = process.env["NEXT_PUBLIC_APP_URL"] ?? "https://app.anthyx.co";

export default function LinksPage() {
  const [links, setLinks] = useState<AffiliateLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [campaign, setCampaign] = useState("");
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api.get<AffiliateLink[]>("/affiliates/links")
      .then(setLinks)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function createLink() {
    setCreating(true);
    try {
      await api.post("/affiliates/links", { campaign: campaign.trim() || undefined });
      setCampaign("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create link");
    } finally {
      setCreating(false);
    }
  }

  function copyLink(code: string) {
    const url = `${BASE_URL}?ref=${code}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(code);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-bold text-white">Tracking Links</h1>
        <p className="text-sm text-gray-500 mt-1">Create unique referral links for each campaign</p>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-950 border border-red-800 text-red-400 text-sm">{error}</div>}

      <div className="mb-6 flex items-center gap-3">
        <input
          type="text"
          value={campaign}
          onChange={(e) => setCampaign(e.target.value)}
          placeholder="Campaign name (optional)"
          className="flex-1 max-w-xs px-3 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <button
          onClick={createLink}
          disabled={creating}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-900 text-white rounded-lg text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          {creating ? "Creating…" : "New link"}
        </button>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Loading…</div>
        ) : links.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">No links yet — create your first one above</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Link</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Campaign</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Clicks</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Conversions</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Created</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {links.map((link) => (
                <tr key={link.id} className="border-b border-gray-800 last:border-0">
                  <td className="px-5 py-3">
                    <span className="font-mono text-purple-400 text-xs">{BASE_URL}?ref={link.code}</span>
                  </td>
                  <td className="px-5 py-3 text-gray-400">{link.campaign ?? "—"}</td>
                  <td className="px-5 py-3 text-white">{link.clicks}</td>
                  <td className="px-5 py-3 text-white">{link.conversions}</td>
                  <td className="px-5 py-3 text-gray-400">{new Date(link.createdAt).toLocaleDateString()}</td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => copyLink(link.code)}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors ml-auto"
                    >
                      {copied === link.code ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied === link.code ? "Copied" : "Copy"}
                    </button>
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
