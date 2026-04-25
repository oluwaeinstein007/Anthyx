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

const port = parseInt(process.env["MCP_PORT"] ?? "3100");

mcp.start({
  transportType: "sse",
  sse: {
    endpoint: "/mcp/sse",
    port,
  },
});

console.log(`[anthyx-mcp] SSE server listening on port ${port}`);
