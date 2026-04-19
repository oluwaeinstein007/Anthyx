"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Webhook, Plus, X, Trash2, Copy, Check, Eye, EyeOff } from "lucide-react";

interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  channels: string[];
  isActive: boolean;
  createdAt: string;
}

interface CreateWebhookResponse extends WebhookEndpoint {
  secret: string;
}

const ALL_EVENTS = [
  "post_published", "post_failed", "post_vetoed", "post_approved",
  "usage_alert", "brand_voice_drift", "ab_test_winner",
];

const ALL_CHANNELS = ["x", "instagram", "linkedin", "facebook", "telegram", "tiktok"];

export default function WebhooksPage() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ url: "", events: [] as string[], channels: [] as string[] });
  const [newSecret, setNewSecret] = useState<{ id: string; secret: string } | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: webhooks = [], isLoading } = useQuery<WebhookEndpoint[]>({
    queryKey: ["webhooks"],
    queryFn: () => api.get<WebhookEndpoint[]>("/webhooks"),
  });

  const create = useMutation({
    mutationFn: () => api.post<CreateWebhookResponse>("/webhooks", {
      url: form.url,
      events: form.events,
      channels: form.channels.length > 0 ? form.channels : null,
    }),
    onSuccess: (data) => {
      setCreating(false);
      setForm({ url: "", events: [], channels: [] });
      setNewSecret({ id: data.id, secret: data.secret });
      qc.invalidateQueries({ queryKey: ["webhooks"] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/webhooks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["webhooks"] }),
  });

  const toggleEvent = (e: string) =>
    setForm((f) => ({ ...f, events: f.events.includes(e) ? f.events.filter((x) => x !== e) : [...f.events, e] }));

  const toggleChannel = (c: string) =>
    setForm((f) => ({ ...f, channels: f.channels.includes(c) ? f.channels.filter((x) => x !== c) : [...f.channels, c] }));

  const copySecret = () => {
    if (newSecret) {
      void navigator.clipboard.writeText(newSecret.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const canCreate = form.url.startsWith("https://") && form.events.length > 0;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Webhooks</h1>
          <p className="text-sm text-gray-500 mt-1">Receive real-time HTTP callbacks for platform events.</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" /> Add endpoint
        </button>
      </div>

      {/* New secret banner — shown once after creation */}
      {newSecret && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <p className="text-sm font-semibold text-amber-800 mb-1">Save your signing secret — shown only once!</p>
          <p className="text-xs text-amber-700 mb-3">Use this to verify webhook payloads via the <code className="bg-amber-100 px-1 py-0.5 rounded">X-Anthyx-Signature</code> header (HMAC-SHA256).</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-white border border-amber-200 rounded-xl px-3.5 py-2.5 text-sm font-mono text-gray-800 overflow-x-auto">
              {showSecret ? newSecret.secret : "•".repeat(48)}
            </code>
            <button onClick={() => setShowSecret((s) => !s)} className="p-2 rounded-lg hover:bg-amber-100 transition-colors text-amber-700">
              {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <button onClick={copySecret} className="p-2 rounded-lg hover:bg-amber-100 transition-colors text-amber-700">
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <button onClick={() => setNewSecret(null)} className="mt-3 text-xs text-amber-600 hover:text-amber-800 underline">
            I&apos;ve saved it — dismiss
          </button>
        </div>
      )}

      {creating && (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 text-sm">New webhook endpoint</h2>
            <button onClick={() => setCreating(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          </div>
          <div className="p-6 space-y-5">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Endpoint URL (must be HTTPS)</label>
              <input
                type="url"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://your-server.com/webhooks/anthyx"
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Subscribe to events</label>
              <div className="flex flex-wrap gap-2">
                {ALL_EVENTS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => toggleEvent(e)}
                    className={`px-3 py-1.5 text-xs rounded-xl border font-medium transition-colors ${
                      form.events.includes(e)
                        ? "bg-green-600 text-white border-green-600"
                        : "border-gray-200 text-gray-600 hover:border-green-300 hover:text-green-700"
                    }`}
                  >
                    {e.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Filter by platform (optional — leave blank for all)</label>
              <div className="flex flex-wrap gap-2">
                {ALL_CHANNELS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleChannel(c)}
                    className={`px-3 py-1.5 text-xs rounded-xl border font-medium transition-colors capitalize ${
                      form.channels.includes(c)
                        ? "bg-gray-800 text-white border-gray-800"
                        : "border-gray-200 text-gray-600 hover:border-gray-400"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => create.mutate()}
                disabled={!canCreate || create.isPending}
                className="px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-sm font-medium rounded-xl transition-colors"
              >
                {create.isPending ? "Creating…" : "Create endpoint"}
              </button>
              <button onClick={() => setCreating(false)} className="px-5 py-2.5 border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 rounded-xl transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(2)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl" />)}
        </div>
      ) : webhooks.length === 0 && !creating ? (
        <div className="text-center py-20 bg-white border border-dashed border-gray-200 rounded-2xl">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Webhook className="w-7 h-7 text-gray-400" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">No webhooks yet</h3>
          <p className="text-sm text-gray-500 mb-5 max-w-xs mx-auto">Register an HTTPS endpoint to receive event callbacks.</p>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" /> Add first endpoint
          </button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100">
          {webhooks.map((wh) => (
            <div key={wh.id} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors group">
              <div className="flex items-center gap-4 min-w-0">
                <div className={`w-2 h-2 rounded-full shrink-0 ${wh.isActive ? "bg-green-500" : "bg-gray-300"}`} />
                <div className="min-w-0">
                  <p className="text-sm font-mono text-gray-800 truncate">{wh.url}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {wh.events.join(", ")}
                    {wh.channels.length > 0 ? ` · ${wh.channels.join(", ")}` : ""}
                  </p>
                </div>
              </div>
              <button
                onClick={() => remove.mutate(wh.id)}
                className="p-1.5 ml-3 shrink-0 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
