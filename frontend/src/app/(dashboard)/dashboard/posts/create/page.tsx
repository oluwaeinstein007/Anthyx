"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  FilePen, Send, X, Hash, Image, AlertCircle, Plus, Sparkles, Bot,
} from "lucide-react";

interface Brand { id: string; name: string; }
interface Agent { id: string; name: string; brandProfileId: string; }

const PLATFORMS = [
  "x", "instagram", "linkedin", "facebook", "telegram",
  "tiktok", "bluesky", "threads", "reddit", "youtube",
  "pinterest", "discord", "whatsapp", "slack",
];

const CONTENT_TYPES = ["educational", "promotional", "entertaining", "inspirational", "news", "announcement", "other"];

const PLATFORM_CHAR_LIMITS: Record<string, number | null> = {
  x: 280,
  instagram: 2200,
  linkedin: 3000,
  telegram: null,
  facebook: 400,
  tiktok: 2200,
  discord: null,
  whatsapp: 4096,
  slack: null,
  reddit: null,
  threads: 500,
  bluesky: 300,
  mastodon: 500,
  youtube: null,
  pinterest: 500,
  email: null,
};

const PLATFORM_TIPS: Record<string, string> = {
  x: "280 chars max. Short, punchy, hooks matter.",
  instagram: "Lead with a strong first line — it shows before 'more'. Up to 2,200 chars.",
  linkedin: "Professional tone. Paragraphs and line breaks improve readability.",
  facebook: "Keep it under 400 chars for best organic reach.",
  tiktok: "Write your caption to complement the video, not repeat it.",
  bluesky: "300 chars. Concise and conversational.",
  threads: "500 chars. Casual and conversational.",
};

function hashtagsFromText(text: string): string[] {
  const matches = text.match(/#(\w+)/g) ?? [];
  return [...new Set(matches.map((h) => h.slice(1).toLowerCase()))];
}

export default function CreatePostPage() {
  const router = useRouter();

  const [brandId, setBrandId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [platform, setPlatform] = useState("instagram");
  const [contentType, setContentType] = useState("educational");
  const [contentText, setContentText] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [mediaUrlInput, setMediaUrlInput] = useState("");
  const [autoHashtags, setAutoHashtags] = useState(true);
  const [error, setError] = useState("");

  const { data: brands = [] } = useQuery<Brand[]>({
    queryKey: ["brands"],
    queryFn: () => api.get<Brand[]>("/brands"),
  });

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["agents"],
    queryFn: () => api.get<Agent[]>("/agents"),
    enabled: true,
  });

  const brandAgents = agents.filter((a) => !brandId || a.brandProfileId === brandId);

  const createPost = useMutation({
    mutationFn: (data: object) => api.post("/posts", data),
    onSuccess: () => router.push("/dashboard/review"),
    onError: (err) => setError(err instanceof Error ? err.message : "Failed to create post"),
  });

  const charLimit = PLATFORM_CHAR_LIMITS[platform] ?? null;
  const charCount = contentText.length;
  const overLimit = charLimit !== null && charCount > charLimit;

  const derivedHashtags = autoHashtags ? hashtagsFromText(contentText) : hashtags;

  function addHashtag() {
    const t = hashtagInput.trim().replace(/^#/, "").toLowerCase();
    if (t && !hashtags.includes(t)) setHashtags((prev) => [...prev, t]);
    setHashtagInput("");
  }

  function addMediaUrl() {
    const u = mediaUrlInput.trim();
    if (u) { setMediaUrls((prev) => [...prev, u]); setMediaUrlInput(""); }
  }

  function handleSubmit() {
    setError("");
    if (!brandId) { setError("Select a brand"); return; }
    if (!contentText.trim()) { setError("Content cannot be empty"); return; }
    if (!scheduledAt) { setError("Pick a scheduled date/time"); return; }
    if (overLimit) { setError(`Content exceeds the ${charLimit} character limit for ${platform}`); return; }

    const tags = autoHashtags ? derivedHashtags : hashtags;

    createPost.mutate({
      brandProfileId: brandId,
      agentId: agentId || undefined,
      platform,
      contentType,
      contentText,
      contentHashtags: tags.length > 0 ? tags : undefined,
      scheduledAt: new Date(scheduledAt).toISOString(),
      mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
    });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center">
          <FilePen className="w-4.5 h-4.5 text-green-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create post</h1>
          <p className="text-sm text-gray-500">Write and schedule a post manually</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100">

        {/* Brand + Platform */}
        <div className="p-6 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Brand <span className="text-red-500">*</span></label>
              <select
                value={brandId}
                onChange={(e) => { setBrandId(e.target.value); setAgentId(""); }}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
              >
                <option value="">Select brand…</option>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Platform <span className="text-red-500">*</span></label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white capitalize"
              >
                {PLATFORMS.map((p) => <option key={p} value={p} className="capitalize">{p}</option>)}
              </select>
            </div>
          </div>

          {/* Agent — optional attribution */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
              <Bot className="w-4 h-4 text-gray-400" />
              Attribute to agent <span className="text-xs text-gray-400 font-normal ml-1">(optional)</span>
            </label>
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              disabled={!brandId}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">No agent (manual post)</option>
              {brandAgents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            {!brandId && (
              <p className="text-xs text-gray-400 mt-1">Select a brand first to see available agents.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Content type</label>
            <div className="flex flex-wrap gap-1.5">
              {CONTENT_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setContentType(t)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-xl border capitalize transition-colors ${
                    contentType === t
                      ? "bg-green-600 text-white border-green-600"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700">Content <span className="text-red-500">*</span></label>
            {charLimit !== null && (
              <span className={`text-xs font-medium tabular-nums ${overLimit ? "text-red-500" : "text-gray-400"}`}>
                {charCount} / {charLimit}
              </span>
            )}
          </div>
          <textarea
            value={contentText}
            onChange={(e) => setContentText(e.target.value)}
            rows={8}
            placeholder={`Write your ${platform} post here…`}
            className={`w-full px-3.5 py-3 border rounded-xl text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 ${
              overLimit
                ? "border-red-400 focus:ring-red-400"
                : "border-gray-300 focus:ring-green-500"
            }`}
          />
          {PLATFORM_TIPS[platform] && (
            <p className="text-xs text-gray-400 flex items-start gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
              {PLATFORM_TIPS[platform]}
            </p>
          )}
        </div>

        {/* Hashtags */}
        <div className="p-6 space-y-3">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Hash className="w-4 h-4 text-gray-400" />
              Hashtags
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
              <input
                type="checkbox"
                checked={autoHashtags}
                onChange={(e) => setAutoHashtags(e.target.checked)}
                className="rounded accent-green-600"
              />
              Auto-detect from content
            </label>
          </div>

          {autoHashtags ? (
            derivedHashtags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {derivedHashtags.map((t) => (
                  <span key={t} className="px-2.5 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-medium">
                    #{t}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">Use #hashtag in your content to auto-detect them.</p>
            )
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  value={hashtagInput}
                  onChange={(e) => setHashtagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addHashtag(); } }}
                  placeholder="e.g. marketing"
                  className="flex-1 px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <button
                  onClick={addHashtag}
                  className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium text-gray-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {hashtags.map((t) => (
                    <span key={t} className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-medium">
                      #{t}
                      <button onClick={() => setHashtags((prev) => prev.filter((x) => x !== t))} className="text-blue-400 hover:text-blue-700">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Media */}
        <div className="p-6 space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Image className="w-4 h-4 text-gray-400" />
            Media URLs <span className="text-xs text-gray-400 font-normal">(optional)</span>
          </label>
          <div className="flex gap-2">
            <input
              value={mediaUrlInput}
              onChange={(e) => setMediaUrlInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addMediaUrl(); } }}
              placeholder="https://cdn.example.com/image.jpg"
              className="flex-1 px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <button
              onClick={addMediaUrl}
              disabled={!mediaUrlInput.trim()}
              className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 rounded-xl text-sm font-medium text-gray-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {mediaUrls.length > 0 && (
            <div className="space-y-1.5">
              {mediaUrls.map((url, i) => (
                <div key={i} className="flex items-center gap-2 p-2.5 bg-gray-50 border border-gray-200 rounded-xl">
                  <span className="text-xs text-gray-600 truncate flex-1 font-mono">{url}</span>
                  <button onClick={() => setMediaUrls((prev) => prev.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500 shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Schedule */}
        <div className="p-6">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Schedule for <span className="text-red-500">*</span>
          </label>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            min={new Date().toISOString().slice(0, 16)}
            className="px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <p className="text-xs text-gray-400 mt-1.5">
            Post will go into the review queue — approve it before it publishes.
          </p>
        </div>

        {/* Error + submit */}
        <div className="p-6 flex items-center gap-4 flex-wrap">
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 w-full">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
          <button
            onClick={handleSubmit}
            disabled={createPost.isPending || overLimit}
            className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            <Send className="w-4 h-4" />
            {createPost.isPending ? "Creating…" : "Submit for review"}
          </button>
          <button
            onClick={() => router.back()}
            className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
