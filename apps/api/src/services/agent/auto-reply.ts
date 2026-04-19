/**
 * Fourth agent: Comment / DM Auto-Reply.
 * Monitors platform inboxes for incoming comments/DMs and generates brand-voice replies.
 * Sits downstream of the Strategist → Copywriter → Reviewer chain — replies must still
 * pass through guardrails and dietInstructions before posting.
 */

import { generateWithFallback, extractJsonObject, GEMINI_PRO, CLAUDE_SONNET } from "./llm-client";
import { buildSystemPromptWithGuardrails } from "./guardrails";
import { retrieveBrandVoiceFromQdrant } from "./brand-context";

export interface IncomingMessage {
  platform: string;
  messageId: string;
  senderHandle: string;
  messageType: "comment" | "dm";
  text: string;
  postId?: string; // for comments — the post being commented on
  postContent?: string; // context for comment replies
  timestamp: string;
}

export interface AutoReplyOutput {
  reply: string;
  shouldReply: boolean; // false if the message should be escalated or ignored
  escalate: boolean; // true if the message requires human attention (complaint, legal, etc.)
  escalationReason?: string;
  confidence: number; // 0–1
}

const AUTO_REPLY_SYSTEM_PROMPT = `
You are a brand social media manager generating replies to incoming comments and DMs.

RULES:
- Always reply in brand voice — never break character
- Never engage with trolls, hate speech, or clearly bad-faith messages (set shouldReply: false, escalate: false)
- Escalate (escalate: true) for: complaints about product/service quality, legal threats, press inquiries, sensitive personal information shared, crisis situations
- Reply should be concise, warm, and on-brand — 1–3 sentences max for comments, slightly longer for DMs
- Never make promises about refunds, replacements, or policies without approval
- If unsure about the intent, err on the side of a friendly acknowledgment rather than a substantive answer
`.trim();

export async function runAutoReplyAgent({
  organizationId,
  agentName,
  brandName,
  brandProfileId,
  dietInstructions,
  message,
}: {
  organizationId: string;
  agentName: string;
  brandName: string;
  brandProfileId: string;
  dietInstructions: string;
  message: IncomingMessage;
}): Promise<AutoReplyOutput> {
  const brandVoice = await retrieveBrandVoiceFromQdrant(brandProfileId, message.text);

  const systemPrompt = await buildSystemPromptWithGuardrails(
    `${AUTO_REPLY_SYSTEM_PROMPT}\n\n## Brand Voice\n${brandVoice}\n\n## Persona: ${agentName} for ${brandName}\n${dietInstructions || "No specific persona instructions."}`,
    organizationId,
  );

  const userMessage = `
Platform: ${message.platform}
Message type: ${message.messageType}
From: @${message.senderHandle}
${message.postContent ? `Post context: "${message.postContent.slice(0, 300)}"` : ""}

Incoming message:
"${message.text}"

Generate an appropriate reply. Return ONLY valid JSON:
{
  "reply": "the reply text",
  "shouldReply": true,
  "escalate": false,
  "escalationReason": null,
  "confidence": 0.9
}
`.trim();

  const raw = await generateWithFallback({
    systemPrompt,
    userMessage,
    geminiModel: GEMINI_PRO,
    claudeModel: CLAUDE_SONNET,
    maxTokens: 512,
  });

  const parsed = extractJsonObject(raw) as AutoReplyOutput;
  return parsed;
}

/**
 * Fetch recent comments/DMs from a platform and reply to unresponded ones.
 * Platform-specific implementations delegate to social-mcp functions.
 */
export async function fetchAndReplyToInbox(
  platform: string,
  accessToken: string,
  accountId: string,
  organizationId: string,
  agentName: string,
  brandName: string,
  brandProfileId: string,
  dietInstructions: string,
): Promise<{ replied: number; escalated: number; skipped: number }> {
  // In production, call the platform's inbox/comment API to fetch recent messages.
  // This stub simulates the workflow — integrate platform-specific fetch calls here.
  console.log(`[AutoReply] Checking ${platform} inbox for ${accountId}`);

  let replied = 0;
  let escalated = 0;
  let skipped = 0;

  // Example: fetch comments from X, Instagram, LinkedIn, etc.
  // const messages = await fetchPlatformMessages(platform, accessToken, accountId);

  // For each message:
  // const replyOutput = await runAutoReplyAgent({ ... message });
  // if (replyOutput.escalate) { escalated++; notify human; }
  // else if (replyOutput.shouldReply) { post reply via social-mcp; replied++; }
  // else { skipped++; }

  return { replied, escalated, skipped };
}
