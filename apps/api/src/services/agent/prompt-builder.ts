import type { Platform } from "@anthyx/types";

const PLATFORM_RULES: Record<Platform, string> = {
  x: "Hard limit: 280 characters including spaces. 1–2 hashtags max. Hook must land in first 8 words. Be punchy and direct.",
  instagram:
    "Caption up to 2,200 characters. Visual-first framing. Use \\n\\n between paragraphs for readability — do NOT write walls of text. CRITICAL: Do NOT include any #hashtags in the caption text. Put hashtags ONLY in the 'hashtags' JSON field — the system posts them as a first comment automatically.",
  linkedin:
    "Professional register. Thought leadership angle. 1,300 character soft limit for full display (content after truncates). Max 3 hashtags inline. Start with a hook, end with a question or CTA. Do NOT use markdown syntax like **bold** or _italic_ — LinkedIn renders these as literal characters.",
  telegram:
    "Conversational, community-first. Use Telegram Markdown v1: *bold*, _italic_, `code`, [text](url). No character limit. Can include links naturally.",
  facebook:
    "Emotional engagement focus. 80 characters ideal for organic reach but up to 400 acceptable. 1–3 hashtags. Use storytelling. Plain text only, no markdown.",
  tiktok:
    'Hook in first 3 words — this is the caption shown before "more" fold (first ~100 chars). Trend-aware. 3–5 hashtags. Be energetic and direct. 2,200 char limit.',
  discord:
    "Community-first tone. Full Markdown supported: **bold**, *italic*, `code`, ```code blocks```, # headers. No hashtags. Conversational and engaging.",
  whatsapp:
    "Conversational, personal register. Use *bold* (single asterisk) and _italic_ (single underscore). No hashtags. Links auto-preview — include them naturally. 4,096 char limit.",
  slack:
    "B2B / internal comms tone. Use Slack mrkdwn: *bold*, _italic_, `code`, <url|text>. No hashtags. Concise and professional.",
  reddit:
    "Community-specific tone. First line becomes the post title (300 char max). Remaining lines are the Markdown body. No hashtags — Reddit uses subreddit communities not hashtags. Provide value to the community.",
  threads:
    "Visual-first framing, same spirit as Instagram. 500 char caption limit. CRITICAL: Do NOT include any #hashtags in the caption — put them ONLY in the 'hashtags' JSON field, posted as a first comment automatically.",
  bluesky:
    "300 character hard limit INCLUDING hashtags. Write hashtags in plain text (e.g. #marketing) — they are encoded as native facets. No markdown. Conversational, tech/creator audience.",
  mastodon:
    "500 character limit. Hashtags inline at end. Decentralised and privacy-conscious tone. Plain text preferred — markdown partially supported.",
  youtube:
    "Description: first 100 characters become the visible preview snippet — front-load the hook. Use 00:00 Chapter Name format for timestamps/chapters. Hashtags in body at end. Informative, value-first tone.",
};

export function getPlatformConstraints(platform: Platform): string {
  return PLATFORM_RULES[platform] ?? "No specific constraints.";
}
