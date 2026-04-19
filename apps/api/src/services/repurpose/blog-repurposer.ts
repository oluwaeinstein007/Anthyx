import { parseUrl } from "../brand-ingestion/parser";
import { generateWithFallback, extractJsonObject, GEMINI_PRO, CLAUDE_SONNET } from "../agent/llm-client";
import { getPlatformConstraints } from "../agent/prompt-builder";
import type { Platform } from "@anthyx/types";

export interface RepurposedPost {
  platform: Platform;
  content: string;
  hashtags: string[];
  suggestedMediaPrompt: string | null;
}

export interface RepurposeResult {
  sourceUrl: string;
  articleTitle: string;
  posts: RepurposedPost[];
}

export async function repurposeBlogPost(
  url: string,
  platforms: Platform[],
  brandVoiceRules: string,
  agentPersona: string,
  brandName: string,
): Promise<RepurposeResult> {
  // 1. Fetch and extract article content
  const parsed = await parseUrl(url);

  // Extract first line as title heuristic
  const lines = parsed.text.split("\n").filter(Boolean);
  const articleTitle = lines[0]?.slice(0, 200) ?? url;
  const body = lines.slice(1).join("\n").slice(0, 4000); // cap context length

  // 2. Generate platform-specific posts from the article
  const platformRules = platforms.map((p) => `${p.toUpperCase()}: ${getPlatformConstraints(p)}`).join("\n");

  const systemPrompt = `
You are ${agentPersona}, a social media copywriter for ${brandName}.

## Brand Voice Rules
${brandVoiceRules}

## Your Task
Repurpose the following blog article into social media posts for each platform listed.
Each post must be independent, platform-native, and reflect the brand voice.
Do NOT just copy-paste the article text — transform it for each platform's audience and format.

## Platform Rules
${platformRules}

## Output Format (return ONLY valid JSON, no prose)
{
  "posts": [
    {
      "platform": "x",
      "content": "tweet text here",
      "hashtags": ["tag1", "tag2"],
      "suggestedMediaPrompt": "image prompt or null"
    }
  ]
}
`.trim();

  const userMessage = `
Article URL: ${url}
Article Title: ${articleTitle}

Article Content:
${body}

Generate one post per platform for these platforms: ${platforms.join(", ")}.
`.trim();

  const raw = await generateWithFallback({
    systemPrompt,
    userMessage,
    geminiModel: GEMINI_PRO,
    claudeModel: CLAUDE_SONNET,
    maxTokens: 4096,
  });

  const parsed2 = extractJsonObject(raw) as { posts: RepurposedPost[] };

  return {
    sourceUrl: url,
    articleTitle,
    posts: parsed2.posts ?? [],
  };
}
