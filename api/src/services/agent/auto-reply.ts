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
 * Fetch recent mentions/messages from a platform and generate brand-voice replies.
 * Uses social-mcp services directly — each call is isolated with per-org credentials.
 */
export async function fetchAndReplyToInbox(
  platform: string,
  accessToken: string, // already decrypted
  accountId: string,
  organizationId: string,
  agentName: string,
  brandName: string,
  brandProfileId: string,
  dietInstructions: string,
  platformConfig: Record<string, unknown> = {},
): Promise<{ replied: number; escalated: number; skipped: number }> {
  const { createRequire } = await import("module");
  const { pathToFileURL } = await import("url");
  const { default: path } = await import("path");

  const req = createRequire(__filename);
  const distRoot = path.dirname(req.resolve("social-mcp"));
  async function importSvc<T>(name: string): Promise<T> {
    return import(pathToFileURL(path.join(distRoot, `services/${name}.js`)).href) as Promise<T>;
  }

  console.log(`[AutoReply] Checking ${platform} inbox for ${accountId}`);

  let messages: IncomingMessage[] = [];

  try {
    switch (platform) {
      case "discord": {
        const channelId = platformConfig["channelId"] as string | undefined;
        if (!channelId) break;
        const { DiscordService } = await importSvc<{
          DiscordService: new (c: { botToken: string }) => {
            getMessages(id: string, limit?: number): Promise<Array<{ id: string; content: string; timestamp: string }>>;
          };
        }>("discord-service");
        const msgs = await new DiscordService({ botToken: accessToken }).getMessages(channelId, 20);
        messages = msgs.map((m) => ({
          platform,
          messageId: m.id,
          senderHandle: channelId,
          messageType: "comment" as const,
          text: m.content,
          timestamp: m.timestamp,
        }));
        break;
      }

      case "slack": {
        const channelId = platformConfig["channelId"] as string | undefined;
        if (!channelId) break;
        const { SlackService } = await importSvc<{
          SlackService: new (c: { botToken: string }) => {
            getMessages(id: string, limit?: number): Promise<Array<{ ts?: string; userId?: string; text?: string }>>;
          };
        }>("slack-service");
        const msgs = await new SlackService({ botToken: accessToken }).getMessages(channelId, 20);
        messages = msgs.map((m) => ({
          platform,
          messageId: m.ts ?? `slack_${Date.now()}`,
          senderHandle: m.userId ?? "unknown",
          messageType: "comment" as const,
          text: m.text ?? "",
          timestamp: m.ts ? new Date(parseFloat(m.ts) * 1000).toISOString() : new Date().toISOString(),
        }));
        break;
      }

      case "x": {
        const handle = platformConfig["handle"] as string | undefined ?? accountId;
        const res = await fetch(
          `https://api.twitter.com/2/tweets/search/recent?query=%40${encodeURIComponent(handle)}&max_results=20&tweet.fields=author_id,created_at,text`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (res.ok) {
          const data = (await res.json()) as {
            data?: Array<{ id: string; text: string; author_id: string; created_at: string }>;
          };
          messages = (data.data ?? []).map((t) => ({
            platform,
            messageId: t.id,
            senderHandle: t.author_id,
            messageType: "comment" as const,
            text: t.text,
            timestamp: t.created_at,
          }));
        }
        break;
      }

      case "mastodon": {
        const instance = platformConfig["instance"] as string | undefined;
        if (!instance) break;
        const notifRes = await fetch(`https://${instance}/api/v1/notifications?types[]=mention&limit=20`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (notifRes.ok) {
          const notifs = (await notifRes.json()) as Array<{
            id: string;
            status?: { id: string; content: string; created_at: string };
            account?: { acct: string };
          }>;
          messages = notifs
            .filter((n) => n.status)
            .map((n) => ({
              platform,
              messageId: n.status!.id,
              senderHandle: n.account?.acct ?? "unknown",
              messageType: "comment" as const,
              text: n.status!.content.replace(/<[^>]+>/g, ""),
              timestamp: n.status!.created_at,
            }));
        }
        break;
      }

      default:
        console.log(`[AutoReply] Platform ${platform} not yet supported for auto-reply`);
        return { replied: 0, escalated: 0, skipped: 0 };
    }
  } catch (err) {
    console.error(`[AutoReply] Fetch error for ${platform}:`, err instanceof Error ? err.message : err);
    return { replied: 0, escalated: 0, skipped: 0 };
  }

  let replied = 0;
  let escalated = 0;
  let skipped = 0;

  for (const message of messages) {
    try {
      const replyOutput = await runAutoReplyAgent({
        organizationId,
        agentName,
        brandName,
        brandProfileId,
        dietInstructions,
        message,
      });

      if (replyOutput.escalate) {
        escalated++;
        console.log(`[AutoReply] Escalated message ${message.messageId} — ${replyOutput.escalationReason}`);
      } else if (replyOutput.shouldReply) {
        // Post reply via the appropriate platform
        await postReply(platform, accessToken, message.messageId, replyOutput.reply, platformConfig, accountId, importSvc);
        replied++;
      } else {
        skipped++;
      }
    } catch (err) {
      console.error(`[AutoReply] Error processing message ${message.messageId}:`, err instanceof Error ? err.message : err);
      skipped++;
    }
  }

  console.log(`[AutoReply] ${platform} — replied: ${replied}, escalated: ${escalated}, skipped: ${skipped}`);
  return { replied, escalated, skipped };
}

async function postReply(
  platform: string,
  accessToken: string,
  messageId: string,
  content: string,
  cfg: Record<string, unknown>,
  accountId: string,
  importSvc: <T>(name: string) => Promise<T>,
): Promise<void> {
  switch (platform) {
    case "discord": {
      const channelId = cfg["channelId"] as string;
      const { DiscordService } = await importSvc<{
        DiscordService: new (c: { botToken: string }) => { sendMessage(id: string, c: string): Promise<unknown> };
      }>("discord-service");
      await new DiscordService({ botToken: accessToken }).sendMessage(channelId, content);
      break;
    }
    case "slack": {
      const channelId = cfg["channelId"] as string;
      const { SlackService } = await importSvc<{
        SlackService: new (c: { botToken: string }) => { sendMessage(id: string, c: string): Promise<unknown> };
      }>("slack-service");
      await new SlackService({ botToken: accessToken }).sendMessage(channelId, content);
      break;
    }
    case "mastodon": {
      const instance = cfg["instance"] as string;
      const { MastodonService } = await importSvc<{
        MastodonService: new (c: { accessToken: string; instanceUrl?: string }) => {
          replyToPost(status: string, inReplyToId: string, visibility?: string): Promise<unknown>;
        };
      }>("mastodon-service");
      await new MastodonService({ accessToken, instanceUrl: `https://${instance}` }).replyToPost(content, messageId, "public");
      break;
    }
    case "x": {
      await fetch("https://api.twitter.com/2/tweets", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text: content, reply: { in_reply_to_tweet_id: messageId } }),
      });
      break;
    }
    default:
      console.warn(`[AutoReply] No reply implementation for platform: ${platform}`);
  }
}
