import type { Platform } from "@anthyx/types";

const PLATFORM_RULES: Record<Platform, string> = {
  x: "Hard limit: 280 characters including spaces. 1–2 hashtags max. Hook must land in first 8 words. Be punchy and direct.",
  instagram: "Caption up to 2,200 characters. Visual-first framing. Save hashtags (20–30) for first comment, not caption. Use line breaks for readability.",
  linkedin: "Professional register. Thought leadership angle. 1,300 character soft limit for full display. Max 3 hashtags inline. Start with a hook, end with a question or CTA.",
  telegram: "Conversational, community-first. Markdown formatting supported. No character limit. Can include links naturally.",
  facebook: "Emotional engagement focus. 80 characters ideal for organic reach but up to 400 acceptable. 1–3 hashtags. Use storytelling.",
  tiktok: 'Hook in first 3 words — this is the caption shown before "more". Trend-aware. 3–5 hashtags. Be energetic and direct.',
};

export function getPlatformConstraints(platform: Platform): string {
  return PLATFORM_RULES[platform] ?? "No specific constraints.";
}
