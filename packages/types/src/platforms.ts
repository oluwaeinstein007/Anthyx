export type Platform = "x" | "instagram" | "linkedin" | "facebook" | "telegram" | "tiktok";

export const PLATFORMS: Platform[] = [
  "x",
  "instagram",
  "linkedin",
  "facebook",
  "telegram",
  "tiktok",
];

export interface PlatformConstraints {
  maxCharacters: number | null;
  maxHashtags: number;
  idealCharacters?: number;
  notes: string;
}

export const PLATFORM_CONSTRAINTS: Record<Platform, PlatformConstraints> = {
  x: {
    maxCharacters: 280,
    maxHashtags: 2,
    notes: "Hard limit: 280 characters including spaces. 1–2 hashtags max. Hook must land in first 8 words.",
  },
  instagram: {
    maxCharacters: 2200,
    maxHashtags: 30,
    notes: "Caption up to 2,200 characters. Visual-first framing. Save hashtags (20–30) for first comment, not caption.",
  },
  linkedin: {
    maxCharacters: null,
    idealCharacters: 1300,
    maxHashtags: 3,
    notes: "Professional register. Thought leadership angle. 1,300 character soft limit for full display. Max 3 hashtags inline.",
  },
  telegram: {
    maxCharacters: null,
    maxHashtags: 10,
    notes: "Conversational, community-first. Markdown formatting supported. No character limit.",
  },
  facebook: {
    maxCharacters: 400,
    idealCharacters: 80,
    maxHashtags: 3,
    notes: "Emotional engagement. 80 characters ideal for reach but up to 400 acceptable. 1–3 hashtags.",
  },
  tiktok: {
    maxCharacters: 2200,
    maxHashtags: 5,
    notes: 'Hook in first 3 words — this is the caption shown before "more". Trend-aware. 3–5 hashtags.',
  },
};

export function getPlatformConstraintsText(platform: Platform): string {
  return PLATFORM_CONSTRAINTS[platform].notes;
}
