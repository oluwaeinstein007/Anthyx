"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface PillarScore {
  pillar: string;
  score: number;
  postCount: number;
}

interface VoicePerformanceProps {
  data: PillarScore[];
  title?: string;
}

const BAR_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export function VoicePerformance({ data, title = "Content pillar performance" }: VoicePerformanceProps) {
  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl">
        Not enough data yet (min. 20 published posts)
      </div>
    );
  }

  const sorted = [...data].sort((a, b) => b.score - a.score);

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={sorted} layout="vertical" margin={{ left: 8, right: 16, top: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
          <XAxis type="number" tick={{ fontSize: 11 }} domain={[0, 1]} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
          <YAxis type="category" dataKey="pillar" tick={{ fontSize: 11 }} width={90} />
          <Tooltip
            formatter={(value: number) => [`${(value * 100).toFixed(2)}%`, "Avg engagement"]}
          />
          <Bar dataKey="score" radius={[0, 4, 4, 0]}>
            {sorted.map((_, i) => (
              <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-3 mt-1">
        {sorted.map((d) => (
          <span key={d.pillar} className="text-xs text-gray-400">
            {d.pillar}: {d.postCount} posts
          </span>
        ))}
      </div>
    </div>
  );
}
