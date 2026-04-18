"use client";

import { useState } from "react";
import { PostPreview } from "./PostPreview";

interface Post {
  id: string;
  platform: "x" | "instagram" | "linkedin" | "facebook" | "telegram" | "tiktok";
  contentText: string;
  contentHashtags?: string[];
  mediaUrls?: string[];
  scheduledAt: string;
}

interface ApprovalBufferProps {
  posts: Post[];
  onApprove: (postId: string) => Promise<void>;
  onBatchApprove: (postIds: string[]) => Promise<void>;
  onVeto: (postId: string) => void;
}

export function ApprovalBuffer({ posts, onApprove, onBatchApprove, onVeto }: ApprovalBufferProps) {
  const [approving, setApproving] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);
  const next5 = posts.slice(0, 5);

  async function handleApprove(postId: string) {
    setApproving((s) => new Set(s).add(postId));
    try {
      await onApprove(postId);
    } finally {
      setApproving((s) => { const n = new Set(s); n.delete(postId); return n; });
    }
  }

  async function handleBatchApprove() {
    setBatchLoading(true);
    try {
      await onBatchApprove(next5.map((p) => p.id));
    } finally {
      setBatchLoading(false);
    }
  }

  if (posts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
        No posts pending review
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {next5.length > 1 && (
        <div className="flex justify-end">
          <button
            onClick={handleBatchApprove}
            disabled={batchLoading}
            className="text-sm px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
          >
            {batchLoading ? "Approving..." : `Approve next ${next5.length}`}
          </button>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {posts.map((post) => (
          <div key={post.id} className="space-y-2">
            <PostPreview
              platform={post.platform}
              content={post.contentText}
              hashtags={post.contentHashtags}
              mediaUrls={post.mediaUrls}
              scheduledAt={post.scheduledAt}
            />
            <div className="flex gap-2">
              <button
                onClick={() => handleApprove(post.id)}
                disabled={approving.has(post.id)}
                className="flex-1 text-sm py-1.5 rounded-md bg-green-100 text-green-800 hover:bg-green-200 disabled:opacity-50"
              >
                {approving.has(post.id) ? "..." : "Approve"}
              </button>
              <button
                onClick={() => onVeto(post.id)}
                className="flex-1 text-sm py-1.5 rounded-md bg-red-100 text-red-800 hover:bg-red-200"
              >
                Veto
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
