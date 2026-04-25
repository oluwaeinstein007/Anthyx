"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { api } from "@/lib/api";

interface Post {
  id: string;
  contentText: string;
  status: string;
  platform: string;
  organizationId: string;
  scheduledAt: string | null;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-800 text-gray-400",
  approved: "bg-blue-900/50 text-blue-400",
  published: "bg-green-900/50 text-green-400",
  failed: "bg-red-900/50 text-red-400",
};

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<Post[]>("/admin/posts")
      .then(setPosts)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = posts.filter(
    (p) =>
      p.contentText.toLowerCase().includes(search.toLowerCase()) ||
      p.platform.toLowerCase().includes(search.toLowerCase()) ||
      p.status.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-bold text-white">Posts</h1>
        <p className="text-sm text-gray-500 mt-1">{posts.length} total</p>
      </div>

      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          placeholder="Search content, platform, status…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm pl-9 pr-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
        />
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-950 border border-red-800 text-red-400 text-sm">{error}</div>}

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">No posts found</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Content</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Platform</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Scheduled</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((post) => (
                <tr key={post.id} className="border-b border-gray-800 last:border-0">
                  <td className="px-5 py-3 max-w-xs">
                    <p className="text-white truncate">{post.contentText}</p>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">{post.organizationId.slice(0, 8)}…</p>
                  </td>
                  <td className="px-5 py-3 text-gray-400 capitalize">{post.platform}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[post.status] ?? "bg-gray-800 text-gray-400"}`}>
                      {post.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-400">
                    {post.scheduledAt ? new Date(post.scheduledAt).toLocaleString() : "—"}
                  </td>
                  <td className="px-5 py-3 text-gray-400">{new Date(post.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
