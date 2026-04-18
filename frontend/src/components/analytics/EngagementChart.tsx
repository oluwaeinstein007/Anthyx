"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface DataPoint {
  date: string;
  [platform: string]: string | number;
}

interface EngagementChartProps {
  data: DataPoint[];
  platforms: string[];
  metric?: "engagementRate" | "likes" | "impressions";
}

const PLATFORM_COLORS: Record<string, string> = {
  x: "#000000",
  instagram: "#E1306C",
  linkedin: "#0A66C2",
  facebook: "#1877F2",
  telegram: "#26A5E4",
  tiktok: "#010101",
};

const METRIC_LABELS: Record<string, string> = {
  engagementRate: "Engagement Rate",
  likes: "Likes",
  impressions: "Impressions",
};

export function EngagementChart({ data, platforms, metric = "engagementRate" }: EngagementChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl">
        No analytics data yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-700">{METRIC_LABELS[metric] ?? metric}</h3>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend />
          {platforms.map((platform) => (
            <Line
              key={platform}
              type="monotone"
              dataKey={`${platform}.${metric}`}
              name={platform}
              stroke={PLATFORM_COLORS[platform] ?? "#888"}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
