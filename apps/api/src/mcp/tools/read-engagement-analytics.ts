import { z } from "zod";
import { computeVoicePerformance, classifyVoices } from "../../services/analytics/scorer";

export const readEngagementAnalyticsTool = {
  name: "read_engagement_analytics",
  description:
    "Read past post engagement performance to identify which content types and voices perform best. Use this to adjust strategy recommendations.",
  inputSchema: z.object({
    brandProfileId: z.string().uuid(),
    lookbackDays: z.number().int().min(7).max(90).default(30),
  }),
  async handler({
    brandProfileId,
    lookbackDays,
  }: {
    brandProfileId: string;
    lookbackDays: number;
  }) {
    const scores = await computeVoicePerformance(brandProfileId, lookbackDays);
    const classification = classifyVoices(scores);

    if (scores.length === 0) {
      return {
        hasData: false,
        message: "No published posts with analytics data yet. Generate plans without feedback loop adjustment.",
        topPerformers: [],
        lowPerformers: [],
        avgEngagementRate: 0,
        classification: { promote: [], demote: [], cut: [] },
      };
    }

    const sorted = [...scores].sort((a, b) => b.avgEngagementRate - a.avgEngagementRate);
    const avgOverall = scores.reduce((a, s) => a + s.avgEngagementRate, 0) / scores.length;

    return {
      hasData: true,
      topPerformers: sorted.slice(0, 3).map((s) => ({
        voiceTrait: s.voiceTrait,
        platform: s.platform,
        avgEngagementRate: (s.avgEngagementRate * 100).toFixed(2) + "%",
        postCount: s.postCount,
        trend: s.trend,
      })),
      lowPerformers: sorted.slice(-3).map((s) => ({
        voiceTrait: s.voiceTrait,
        platform: s.platform,
        avgEngagementRate: (s.avgEngagementRate * 100).toFixed(2) + "%",
        postCount: s.postCount,
        trend: s.trend,
      })),
      avgEngagementRate: (avgOverall * 100).toFixed(2) + "%",
      classification,
    };
  },
};
