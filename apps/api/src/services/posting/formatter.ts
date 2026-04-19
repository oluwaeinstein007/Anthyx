import type { Platform } from "@anthyx/types";

export interface FormattedPost {
  primaryText: string;
  firstComment?: string;    // Instagram / Threads hashtag comment
  hashtags?: string[];      // platforms that take hashtags as separate fields
  markupMode?: "markdown" | "html" | "none";
  segments?: string[];      // threads / carousels (multi-part content)
  truncated: boolean;
}

export function formatPostForPlatform(
  platform: Platform,
  content: string,
  hashtags: string[],
): FormattedPost {
  switch (platform) {
    case "x":
      return formatForX(content, hashtags);
    case "instagram":
      return formatForInstagram(content, hashtags);
    case "threads":
      return formatForThreads(content, hashtags);
    case "linkedin":
      return formatForLinkedIn(content, hashtags);
    case "telegram":
      return formatForTelegram(content, hashtags);
    case "facebook":
      return formatForFacebook(content, hashtags);
    case "tiktok":
      return formatForTikTok(content, hashtags);
    case "bluesky":
      return formatForBluesky(content, hashtags);
    case "discord":
      return formatForDiscord(content, hashtags);
    case "reddit":
      return formatForReddit(content, hashtags);
    case "youtube":
      return formatForYouTube(content, hashtags);
    case "whatsapp":
      return formatForWhatsApp(content, hashtags);
    case "slack":
      return formatForSlack(content, hashtags);
    case "mastodon":
      return formatForMastodon(content, hashtags);
    default:
      return { primaryText: content, truncated: false };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildHashtagString(tags: string[]): string {
  return tags.map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" ");
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "");
}

// Convert **bold** / _italic_ / [text](url) to Telegram Markdown v1 subset
function toTelegramMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "*$1*")
    .replace(/__(.+?)__/g, "_$1_")
    .replace(/\[(.+?)\]\((.+?)\)/g, "[$1]($2)");
}

// Convert **bold** / [text](url) to Slack mrkdwn
function toSlackMrkdwn(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "*$1*")
    .replace(/\*(?!\*)(.+?)(?<!\*)\*/g, "_$1_")
    .replace(/\[(.+?)\]\((.+?)\)/g, "<$2|$1>");
}

// Convert **bold** / *italic* to WhatsApp formatting
function toWhatsAppFormat(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "*$1*")
    .replace(/\*(?!\*)(.+?)(?<!\*)\*/g, "_$1_");
}

// ── Platform formatters ───────────────────────────────────────────────────────

function formatForX(content: string, hashtags: string[]): FormattedPost {
  const LIMIT = 280;
  const tags = hashtags.slice(0, 2);
  const tagString = tags.length ? " " + buildHashtagString(tags) : "";

  let primary = content;
  let truncated = false;

  if ((primary + tagString).length > LIMIT) {
    const maxContent = LIMIT - tagString.length;
    primary = primary.slice(0, maxContent).trimEnd();
    // Avoid cutting mid-word
    const lastSpace = primary.lastIndexOf(" ");
    if (lastSpace > LIMIT * 0.8) primary = primary.slice(0, lastSpace);
    truncated = true;
  }

  return { primaryText: primary + tagString, truncated, markupMode: "none" };
}

function formatForInstagram(content: string, hashtags: string[]): FormattedPost {
  const LIMIT = 2200;
  let primary = stripMarkdown(content).slice(0, LIMIT);
  const truncated = content.length > LIMIT;
  const firstComment = hashtags.length ? buildHashtagString(hashtags) : undefined;

  return { primaryText: primary, firstComment, truncated, markupMode: "none" };
}

function formatForThreads(content: string, hashtags: string[]): FormattedPost {
  const LIMIT = 500;
  let primary = stripMarkdown(content).slice(0, LIMIT);
  const truncated = content.length > LIMIT;
  const firstComment = hashtags.length ? buildHashtagString(hashtags) : undefined;

  return { primaryText: primary, firstComment, truncated, markupMode: "none" };
}

function formatForLinkedIn(content: string, hashtags: string[]): FormattedPost {
  const LIMIT = 3000;
  const tags = hashtags.slice(0, 3);
  const tagString = tags.length ? "\n\n" + buildHashtagString(tags) : "";

  // Strip markdown (LinkedIn renders it as literal characters)
  let primary = stripMarkdown(content);
  let truncated = false;

  if ((primary + tagString).length > LIMIT) {
    primary = primary.slice(0, LIMIT - tagString.length).trimEnd();
    truncated = true;
  }

  return { primaryText: primary + tagString, truncated, markupMode: "none" };
}

function formatForTelegram(content: string, hashtags: string[]): FormattedPost {
  const text = toTelegramMarkdown(content);
  return { primaryText: text, truncated: false, markupMode: "markdown" };
}

function formatForFacebook(content: string, hashtags: string[]): FormattedPost {
  const SOFT_LIMIT = 400;
  const tags = hashtags.slice(0, 3);
  const tagString = tags.length ? " " + buildHashtagString(tags) : "";
  const primary = stripMarkdown(content);
  const truncated = (primary + tagString).length > SOFT_LIMIT;

  return { primaryText: primary + tagString, truncated, markupMode: "none" };
}

function formatForTikTok(content: string, hashtags: string[]): FormattedPost {
  const LIMIT = 2200;
  const FOLD = 100;
  const tags = hashtags.slice(0, 5);
  const tagString = tags.length ? " " + buildHashtagString(tags) : "";

  let primary = stripMarkdown(content);
  let truncated = false;

  // Warn if hook doesn't appear within the first FOLD chars
  if (primary.length > FOLD && !primary.slice(0, FOLD).includes(".") && !primary.slice(0, FOLD).includes("!")) {
    // Can't fix this automatically, but flag it
    truncated = false;
  }

  if ((primary + tagString).length > LIMIT) {
    primary = primary.slice(0, LIMIT - tagString.length).trimEnd();
    truncated = true;
  }

  return { primaryText: primary + tagString, truncated, markupMode: "none" };
}

function formatForBluesky(content: string, hashtags: string[]): FormattedPost {
  const LIMIT = 300;
  const tags = hashtags.slice(0, 5);
  const tagString = tags.length ? " " + buildHashtagString(tags) : "";

  let primary = stripMarkdown(content);
  let truncated = false;

  if ((primary + tagString).length > LIMIT) {
    primary = primary.slice(0, LIMIT - tagString.length).trimEnd();
    const lastSpace = primary.lastIndexOf(" ");
    if (lastSpace > LIMIT * 0.7) primary = primary.slice(0, lastSpace);
    truncated = true;
  }

  return { primaryText: primary + tagString, truncated, markupMode: "none" };
}

function formatForDiscord(content: string, hashtags: string[]): FormattedPost {
  // Discord supports full Markdown — pass through as-is, no hashtags
  return { primaryText: content, truncated: false, markupMode: "markdown" };
}

function formatForReddit(content: string, hashtags: string[]): FormattedPost {
  const TITLE_LIMIT = 300;
  const lines = content.split("\n");
  const titleRaw = stripMarkdown(lines[0] ?? "").slice(0, TITLE_LIMIT);
  const body = lines.slice(1).join("\n").trim(); // rest is Markdown body, no hashtags

  // Reddit posts are split into title + body; we encode both in primaryText separated by \n\n
  const combined = titleRaw + (body ? "\n\n" + body : "");
  return { primaryText: combined, truncated: false, markupMode: "markdown" };
}

function formatForYouTube(content: string, hashtags: string[]): FormattedPost {
  const tags = hashtags.slice(0, 15);
  const tagString = tags.length ? "\n\n" + buildHashtagString(tags) : "";
  const primary = stripMarkdown(content);
  return { primaryText: primary + tagString, truncated: false, markupMode: "none" };
}

function formatForWhatsApp(content: string, hashtags: string[]): FormattedPost {
  const LIMIT = 4096;
  // Convert markdown to WhatsApp formatting, strip hashtags
  let primary = toWhatsAppFormat(content).slice(0, LIMIT);
  return { primaryText: primary, truncated: content.length > LIMIT, markupMode: "none" };
}

function formatForSlack(content: string, hashtags: string[]): FormattedPost {
  const primary = toSlackMrkdwn(content);
  return { primaryText: primary, truncated: false, markupMode: "markdown" };
}

function formatForMastodon(content: string, hashtags: string[]): FormattedPost {
  const LIMIT = 500;
  const tags = hashtags.slice(0, 10);
  const tagString = tags.length ? "\n\n" + buildHashtagString(tags) : "";
  let primary = stripMarkdown(content);
  let truncated = false;

  if ((primary + tagString).length > LIMIT) {
    primary = primary.slice(0, LIMIT - tagString.length).trimEnd();
    truncated = true;
  }

  return { primaryText: primary + tagString, truncated, markupMode: "none" };
}
