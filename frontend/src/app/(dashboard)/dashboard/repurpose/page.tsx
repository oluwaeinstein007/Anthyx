"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Rss, Sparkles, Copy, Check } from "lucide-react";

interface Agent { id: string; name: string; brandProfileId: string; }

interface RepurposedPost {
  platform: string;
  content: string;
  hashtags: string[];
  contentType: string;
}

interface RepurposeResult {
  sourceUrl: string;
  sourceTitle: string;
  posts: RepurposedPost[];
}

const PLATFORMS = ["x", "instagram", "linkedin", "facebook", "telegram", "tiktok", "bluesky", "threads", "reddit"];

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "bg-pink-50 text-pink-700",
  x: "bg-gray-100 text-gray-700",
  linkedin: "bg-blue-50 text-blue-700",
  facebook: "bg-blue-50 text-blue-600",
  telegram: "bg-sky-50 text-sky-700",
  tiktok: "bg-gray-100 text-gray-700",
  bluesky: "bg-sky-50 text-sky-700",
  threads: "bg-gray-100 text-gray-700",
  reddit: "bg-orange-50 text-orange-700",
};

export default function RepurposePage() {
  const [url, setUrl] = useState("");
  const [agentId, setAgentId] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(["x", "instagram", "linkedin"]);
  const [result, setResult] = useState<RepurposeResult | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const { data: agents = [] } = useQuery<Agent[]>({ queryKey: ["agents"], queryFn: () => api.get<Agent[]>("/agents") });

  const repurpose = useMutation({
    mutationFn: () => api.post<RepurposeResult>("/repurpose/blog", { url, agentId, platforms }),
    onSuccess: (data) => setResult(data),
  });

  const togglePlatform = (p: string) =>
    setPlatforms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);

  const copyText = (text: string, id: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const canSubmit = url.trim().startsWith("http") && agentId && platforms.length > 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Repurpose Content</h1>
        <p className="text-sm text-gray-500 mt-1">Turn a blog post or article URL into platform-ready social content.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2.5">
          <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
            <Rss className="w-4 h-4 text-green-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 text-sm">Blog → Social posts</h2>
            <p className="text-xs text-gray-400">AI reads the article and generates on-brand posts for each platform</p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Article URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://yourblog.com/article-title"
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Agent (brand voice)</label>
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
            >
              <option value="">Select agent…</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Target platforms</label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePlatform(p)}
                  className={`px-3.5 py-1.5 text-xs rounded-xl border font-medium transition-colors capitalize ${
                    platforms.includes(p)
                      ? "bg-green-600 text-white border-green-600"
                      : "border-gray-200 text-gray-600 hover:border-green-300 hover:text-green-700"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => repurpose.mutate()}
            disabled={!canSubmit || repurpose.isPending}
            className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            {repurpose.isPending ? "Repurposing article…" : `Generate ${platforms.length} post${platforms.length !== 1 ? "s" : ""}`}
          </button>

          {repurpose.isError && (
            <p className="text-xs text-red-600">Failed to repurpose. Make sure the URL is publicly accessible.</p>
          )}
        </div>
      </div>

      {result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">
              Generated from: <span className="text-green-700 font-normal truncate max-w-xs inline-block align-bottom">{result.sourceTitle || result.sourceUrl}</span>
            </h2>
            <span className="text-xs text-gray-400">{result.posts.length} posts</span>
          </div>

          <div className="space-y-4">
            {result.posts.map((post, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${PLATFORM_COLORS[post.platform] ?? "bg-gray-100 text-gray-700"}`}>
                      {post.platform}
                    </span>
                    <span className="text-xs text-gray-400 capitalize">{post.contentType}</span>
                  </div>
                  <button
                    onClick={() => copyText(post.content + (post.hashtags.length ? "\n\n" + post.hashtags.map((t) => `#${t}`).join(" ") : ""), `${i}`)}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    {copied === `${i}` ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                    {copied === `${i}` ? "Copied!" : "Copy"}
                  </button>
                </div>
                <div className="p-5">
                  <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{post.content}</p>
                  {post.hashtags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {post.hashtags.map((tag) => (
                        <span key={tag} className="text-xs text-blue-500 font-medium">#{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
