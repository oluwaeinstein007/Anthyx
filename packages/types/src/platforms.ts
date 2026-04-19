export type Platform =
  | "x"
  | "instagram"
  | "linkedin"
  | "facebook"
  | "telegram"
  | "tiktok"
  | "discord"
  | "whatsapp"
  | "slack"
  | "reddit"
  | "threads"
  | "bluesky"
  | "mastodon"
  | "youtube";

export const PLATFORMS: Platform[] = [
  "x",
  "instagram",
  "linkedin",
  "facebook",
  "telegram",
  "tiktok",
  "discord",
  "whatsapp",
  "slack",
  "reddit",
  "threads",
  "bluesky",
  "mastodon",
  "youtube",
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
  discord: {
    maxCharacters: 2000,
    maxHashtags: 0,
    notes: "Full Markdown supported (bold, italic, code blocks, headers). No hashtags. Community-first tone.",
  },
  whatsapp: {
    maxCharacters: 4096,
    maxHashtags: 0,
    notes: "Bold via *text*, italic via _text_. No hashtags. Links auto-preview. Conversational register.",
  },
  slack: {
    maxCharacters: null,
    maxHashtags: 0,
    notes: "Slack mrkdwn: *bold*, _italic_, `code`, <url|text>. No hashtags. B2B / internal comms tone.",
  },
  reddit: {
    maxCharacters: null,
    maxHashtags: 0,
    notes: "Title (first line, 300 char max) + Markdown body. No inline hashtags. Community-specific tone.",
  },
  threads: {
    maxCharacters: 500,
    maxHashtags: 30,
    notes: "Same caption rules as Instagram — hashtags in first comment. Visual-first framing. 500 char caption limit.",
  },
  bluesky: {
    maxCharacters: 300,
    maxHashtags: 5,
    notes: "300 char hard limit including hashtags. Hashtags as plain text (encoded as facets by publisher). No markdown.",
  },
  mastodon: {
    maxCharacters: 500,
    maxHashtags: 10,
    notes: "500 char limit. Hashtags inline. Markdown partially supported. Decentralised, brand-safe tone.",
  },
  youtube: {
    maxCharacters: null,
    maxHashtags: 15,
    notes: "Description: first 100 chars are the visible preview snippet. Chapters as 00:00 Section name. Hashtags in body.",
  },
};

export function getPlatformConstraintsText(platform: Platform): string {
  return PLATFORM_CONSTRAINTS[platform].notes;
}
