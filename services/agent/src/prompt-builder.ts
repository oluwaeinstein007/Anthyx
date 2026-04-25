import type { Platform } from "@anthyx/types";

const PLATFORM_RULES: Record<Platform, string> = {
  x: "Hard limit: 280 characters including spaces. 1–2 hashtags max. Hook must land in first 8 words. Be punchy and direct.",
  instagram: "Caption up to 2,200 characters. Visual-first framing. Save hashtags (20–30) for first comment, not caption. Use line breaks for readability.",
  linkedin: "Professional register. Thought leadership angle. 1,300 character soft limit for full display. Max 3 hashtags inline. Start with a hook, end with a question or CTA.",
  telegram: "Conversational, community-first. Markdown formatting supported. No character limit. Can include links naturally.",
  facebook: "Emotional engagement focus. 80 characters ideal for organic reach but up to 400 acceptable. 1–3 hashtags. Use storytelling.",
  tiktok: 'Hook in first 3 words — this is the caption shown before "more". Trend-aware. 3–5 hashtags. Be energetic and direct.',
  discord: "Full Markdown supported (bold, italic, code blocks, headers). No hashtags. Community-first tone. 2,000 character limit.",
  whatsapp: "Bold via *text*, italic via _text_. No hashtags. Links auto-preview. Conversational register. 4,096 character limit.",
  slack: "Slack mrkdwn: *bold*, _italic_, `code`, <url|text>. No hashtags. B2B / internal comms tone.",
  reddit: "Title (first line, 300 char max) + Markdown body. No inline hashtags. Community-specific tone.",
  threads: "Same caption rules as Instagram — hashtags in first comment. Visual-first framing. 500 character caption limit.",
  bluesky: "300 character hard limit including hashtags. Hashtags as plain text. No markdown.",
  mastodon: "500 character limit. Hashtags inline. Markdown partially supported. Decentralised, brand-safe tone.",
  youtube: "Description: first 100 chars are the visible preview snippet. Chapters as 00:00 Section name. Up to 15 hashtags in body.",
  pinterest: "Image required. Title (100 char max) + description up to 500 chars. Visual-first — image is primary.",
  email: "Subject line (50 char ideal), preview text (90 char), HTML body. No hashtags. CTA required.",
};

export function getPlatformConstraints(platform: Platform): string {
  return PLATFORM_RULES[platform] ?? "No specific constraints.";
}
