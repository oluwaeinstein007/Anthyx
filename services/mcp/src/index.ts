import { FastMCP } from "fastmcp";
import { z } from "zod";

import { retrieveBrandContext } from "./tools/retrieve-brand-context";
import { retrieveBrandVoice } from "./tools/retrieve-brand-voice";
import { retrieveBrandRules } from "./tools/retrieve-brand-rules";
import { retrieveDietInstructions } from "./tools/retrieve-diet-instructions";
import { readEngagementAnalytics } from "./tools/read-engagement-analytics";
import { schedulePost } from "./tools/schedule-post";
import { webSearchTrends } from "./tools/web-search-trends";
import { generateImageAsset } from "./tools/generate-image-asset";

const mcp = new FastMCP("anthyx-mcp-server");

mcp.addTool({
  name: "retrieve_brand_context",
  description: "Retrieve relevant brand knowledge chunks and voice metadata from Qdrant for a brand profile.",
  parameters: z.object({
    brandProfileId: z.string().uuid(),
    query: z.string().describe("Semantic search query for relevant brand content"),
    topK: z.number().int().min(1).max(20).default(10),
  }),
  execute: async (args) => retrieveBrandContext(args),
});

mcp.addTool({
  name: "retrieve_brand_voice",
  description: "Retrieve brand voice rules, tone descriptors, and brand statements for a specific topic.",
  parameters: z.object({
    brandProfileId: z.string().uuid(),
    topic: z.string().describe("Topic to match against voice rules"),
  }),
  execute: async (args) => retrieveBrandVoice(args),
});

mcp.addTool({
  name: "retrieve_brand_rules",
  description: "Retrieve all active brand guidelines including voice traits, tone, and colors.",
  parameters: z.object({
    brandProfileId: z.string().uuid(),
  }),
  execute: async (args) => retrieveBrandRules(args),
});

mcp.addTool({
  name: "retrieve_diet_instructions",
  description: "Retrieve content diet instructions and prohibitions for an agent.",
  parameters: z.object({
    agentId: z.string().uuid(),
  }),
  execute: async (args) => retrieveDietInstructions(args),
});

mcp.addTool({
  name: "read_engagement_analytics",
  description: "Read post engagement analytics for a brand profile and classify content performance.",
  parameters: z.object({
    brandProfileId: z.string().uuid(),
    lookbackDays: z.number().int().min(1).max(90).default(30),
  }),
  execute: async (args) => readEngagementAnalytics(args),
});

mcp.addTool({
  name: "schedule_post",
  description: "Schedule an approved post for publishing via BullMQ with jitter.",
  parameters: z.object({
    postId: z.string().uuid(),
    scheduledAt: z.string().describe("ISO 8601 datetime string for desired publish time"),
  }),
  execute: async (args) => schedulePost(args),
});

mcp.addTool({
  name: "web_search_trends",
  description: "Search for trending topics and news in an industry using Tavily.",
  parameters: z.object({
    industry: z.string(),
    keywords: z.array(z.string()).min(1).max(10),
    timeframe: z.enum(["7d", "30d"]).default("7d"),
  }),
  execute: async (args) => webSearchTrends(args),
});

mcp.addTool({
  name: "generate_image_asset",
  description: "Generate a marketing image asset via DALL-E 3 aligned with brand colors.",
  parameters: z.object({
    prompt: z.string().describe("Visual description of the image"),
    brandColors: z.array(z.string()).describe("Hex color codes e.g. ['#FF5733', '#2C3E50']"),
    aspectRatio: z.enum(["1:1", "16:9"]).default("1:1"),
  }),
  execute: async (args) => generateImageAsset(args),
});

// ── Pinterest tools (via social-mcp) ─────────────────────────────────────────
// Install: pnpm add social-mcp --filter @anthyx/mcp
// Requires PINTEREST_ACCESS_TOKEN in env.
// Once installed, uncomment the block below and remove this comment.
//
// import { createPin, getBoards, getBoardPins } from "social-mcp/pinterest";
//
// mcp.addTool({
//   name: "pinterest_create_pin",
//   description: "Create a Pinterest pin on a board. Image URL is required.",
//   parameters: z.object({
//     boardId: z.string(),
//     title: z.string(),
//     description: z.string(),
//     imageUrl: z.string().url(),
//     link: z.string().url().optional(),
//   }),
//   execute: async (args) => createPin(args),
// });
//
// mcp.addTool({
//   name: "pinterest_get_boards",
//   description: "List all boards for the authenticated Pinterest account.",
//   parameters: z.object({ limit: z.number().int().min(1).max(50).default(25) }),
//   execute: async (args) => getBoards(args),
// });
//
// mcp.addTool({
//   name: "pinterest_get_board_pins",
//   description: "Fetch pins (saves/impressions) from a Pinterest board for analytics.",
//   parameters: z.object({ boardId: z.string(), limit: z.number().int().min(1).max(100).default(25) }),
//   execute: async (args) => getBoardPins(args),
// });

// ── Email tools (via social-mcp) ──────────────────────────────────────────────
// Install: pnpm add social-mcp --filter @anthyx/mcp
// Requires MAIL_MAILER + MAIL_FROM_ADDRESS in env (smtp | sendgrid | mailgun).
// Once installed, uncomment the block below and remove this comment.
//
// import { sendEmail, sendBulkEmail } from "social-mcp/email";
//
// mcp.addTool({
//   name: "email_send",
//   description: "Send a transactional email to a single recipient.",
//   parameters: z.object({
//     to: z.string().email(),
//     subject: z.string(),
//     html: z.string(),
//     text: z.string().optional(),
//   }),
//   execute: async (args) => sendEmail(args),
// });
//
// mcp.addTool({
//   name: "email_send_bulk",
//   description: "Send a campaign email to multiple recipients via the configured mail driver.",
//   parameters: z.object({
//     recipients: z.array(z.string().email()),
//     subject: z.string(),
//     html: z.string(),
//     text: z.string().optional(),
//   }),
//   execute: async (args) => sendBulkEmail(args),
// });

// ── Social inbox read tools (via social-mcp) ──────────────────────────────────
// These seed the engagement inbox (§4.1). Uncomment once social-mcp is installed.
//
// import { searchTweets, getInstagramPosts, getFacebookPosts, getLinkedinPosts } from "social-mcp";
//
// mcp.addTool({
//   name: "search_tweets",
//   description: "Fetch recent mentions and replies on X (Twitter).",
//   parameters: z.object({ query: z.string(), limit: z.number().int().default(20) }),
//   execute: async (args) => searchTweets(args),
// });

const port = parseInt(process.env["MCP_PORT"] ?? "3100");

mcp.start({
  transportType: "sse",
  sse: {
    endpoint: "/mcp/sse",
    port,
  },
});

console.log(`[anthyx-mcp] SSE server listening on port ${port}`);
