"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { FlaskConical, Trophy, Clock, CheckCircle2, AlertCircle } from "lucide-react";

interface AbTest {
  id: string;
  postAId: string;
  postBId: string;
  winnerId: string | null;
  status: "running" | "winner_promoted";
  promotedAt: string | null;
  createdAt: string;
}

interface Post {
  id: string;
  contentText: string;
  platform: string;
  status: string;
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  running: <Clock className="w-4 h-4 text-blue-500" />,
  winner_promoted: <CheckCircle2 className="w-4 h-4 text-green-500" />,
};

function AbTestCard({
  test,
  postA,
  postB,
  onPromote,
  promoting,
}: {
  test: AbTest;
  postA: Post | undefined;
  postB: Post | undefined;
  onPromote: (id: string) => void;
  promoting: boolean;
}) {
  const isRunning = test.status === "running";
  const winnerIsA = test.winnerId === test.postAId;
  const winnerIsB = test.winnerId === test.postBId;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-purple-500" />
          <span className="text-sm font-semibold text-gray-900">A/B Test</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            isRunning ? "bg-blue-50 text-blue-600" : "bg-green-50 text-green-600"
          }`}>{test.status.replace("_", " ")}</span>
        </div>
        <span className="text-xs text-gray-400">{new Date(test.createdAt).toLocaleDateString()}</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Variant A", post: postA, isWinner: winnerIsA },
          { label: "Variant B", post: postB, isWinner: winnerIsB },
        ].map(({ label, post, isWinner }) => (
          <div
            key={label}
            className={`p-3 rounded-xl border text-sm ${
              isWinner ? "border-green-300 bg-green-50" : "border-gray-200 bg-gray-50"
            }`}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <span className={`text-xs font-semibold ${isWinner ? "text-green-700" : "text-gray-600"}`}>{label}</span>
              {isWinner && <Trophy className="w-3 h-3 text-green-500" />}
            </div>
            <p className="text-gray-700 text-xs leading-relaxed line-clamp-3">
              {post?.contentText ?? <span className="text-gray-400 italic">Loading…</span>}
            </p>
            {post && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs capitalize text-gray-400">{post.platform}</span>
                <span className="text-xs text-gray-300">·</span>
                <span className="text-xs text-gray-400 capitalize">{post.status}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {isRunning && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => onPromote(test.id)}
            disabled={promoting}
            className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white rounded-xl text-xs font-semibold transition-colors"
          >
            <Trophy className="w-3.5 h-3.5" />
            {promoting ? "Evaluating…" : "Pick winner by engagement"}
          </button>
          <p className="text-xs text-gray-400">Requires engagement data from both variants</p>
        </div>
      )}

      {!isRunning && test.promotedAt && (
        <p className="text-xs text-gray-400">Winner promoted {new Date(test.promotedAt).toLocaleDateString()}</p>
      )}
    </div>
  );
}

export default function AbTestsPage() {
  const qc = useQueryClient();

  const { data: tests = [], isLoading } = useQuery<AbTest[]>({
    queryKey: ["ab-tests"],
    queryFn: () => api.get("/posts/ab-tests"),
  });

  const postIds = tests.flatMap((t) => [t.postAId, t.postBId]);
  const { data: postsMap = {} } = useQuery<Record<string, Post>>({
    queryKey: ["ab-test-posts", postIds],
    queryFn: async () => {
      if (postIds.length === 0) return {};
      const results = await Promise.all(
        [...new Set(postIds)].map((id) =>
          api.get<Post>(`/posts/${id}`).catch(() => null)
        )
      );
      const map: Record<string, Post> = {};
      results.forEach((p) => { if (p) map[p.id] = p; });
      return map;
    },
    enabled: postIds.length > 0,
  });

  const { mutate: promote, variables: promotingId } = useMutation({
    mutationFn: (abTestId: string) =>
      api.post<{ winnerId: string; reason: string }>(`/posts/ab-tests/${abTestId}/promote`),
    onSuccess: (result, abTestId) => {
      qc.invalidateQueries({ queryKey: ["ab-tests"] });
      alert(`Winner selected! ${result.reason}`);
    },
    onError: (err) => {
      alert(err instanceof Error ? err.message : "Failed to promote winner");
    },
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-bold text-gray-900">A/B Tests</h1>
        <p className="text-sm text-gray-500 mt-1">
          Compare content variants and promote the winner based on engagement data
        </p>
      </div>

      {isLoading && <div className="text-sm text-gray-400">Loading tests…</div>}

      {!isLoading && tests.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
          <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FlaskConical className="w-6 h-6 text-purple-400" />
          </div>
          <p className="text-sm font-semibold text-gray-700 mb-1">No A/B tests yet</p>
          <p className="text-xs text-gray-400 max-w-xs mx-auto">
            Go to the <strong>Review</strong> page, open a post, and click &ldquo;A/B test&rdquo; to generate a variant.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {tests.map((test) => (
          <AbTestCard
            key={test.id}
            test={test}
            postA={postsMap[test.postAId]}
            postB={postsMap[test.postBId]}
            onPromote={promote}
            promoting={promotingId === test.id}
          />
        ))}
      </div>
    </div>
  );
}
