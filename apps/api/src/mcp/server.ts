import type { Express } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { retrieveBrandContextTool } from "./tools/retrieve-brand-context";
import { retrieveBrandVoiceTool } from "./tools/retrieve-brand-voice";
import { webSearchTrendsTool } from "./tools/web-search-trends";
import { readEngagementAnalyticsTool } from "./tools/read-engagement-analytics";
import { retrieveDietInstructionsTool } from "./tools/retrieve-diet-instructions";
import { retrieveBrandRulesTool } from "./tools/retrieve-brand-rules";
import { generateImageAssetTool } from "./tools/generate-image-asset";
import { schedulePostTool } from "./tools/schedule-post";

const mcpServer = new McpServer({
  name: "anthyx-agent-server",
  version: "1.0.0",
});

// Strategist tools
mcpServer.tool(
  retrieveBrandContextTool.name,
  retrieveBrandContextTool.inputSchema.shape as Record<string, unknown>,
  retrieveBrandContextTool.handler,
);
mcpServer.tool(
  webSearchTrendsTool.name,
  webSearchTrendsTool.inputSchema.shape as Record<string, unknown>,
  webSearchTrendsTool.handler,
);
mcpServer.tool(
  readEngagementAnalyticsTool.name,
  readEngagementAnalyticsTool.inputSchema.shape as Record<string, unknown>,
  readEngagementAnalyticsTool.handler,
);

// Copywriter tools
mcpServer.tool(
  retrieveBrandVoiceTool.name,
  retrieveBrandVoiceTool.inputSchema.shape as Record<string, unknown>,
  retrieveBrandVoiceTool.handler,
);
mcpServer.tool(
  generateImageAssetTool.name,
  generateImageAssetTool.inputSchema.shape as Record<string, unknown>,
  generateImageAssetTool.handler,
);

// Reviewer tools
mcpServer.tool(
  retrieveDietInstructionsTool.name,
  retrieveDietInstructionsTool.inputSchema.shape as Record<string, unknown>,
  retrieveDietInstructionsTool.handler,
);
mcpServer.tool(
  retrieveBrandRulesTool.name,
  retrieveBrandRulesTool.inputSchema.shape as Record<string, unknown>,
  retrieveBrandRulesTool.handler,
);

// Shared
mcpServer.tool(
  schedulePostTool.name,
  schedulePostTool.inputSchema.shape as Record<string, unknown>,
  schedulePostTool.handler,
);

// One transport per SSE connection, keyed by sessionId
const activeTransports = new Map<string, SSEServerTransport>();

export function registerMcpRoutes(app: Express): void {
  // Agents open an SSE connection here to receive MCP messages
  app.get("/mcp/sse", async (_req, res) => {
    const transport = new SSEServerTransport("/mcp/messages", res);
    activeTransports.set(transport.sessionId, transport);

    res.on("close", () => {
      activeTransports.delete(transport.sessionId);
    });

    await mcpServer.connect(transport);
    console.log(`[MCP] SSE session opened: ${transport.sessionId}`);
  });

  // Agents POST tool calls to this endpoint
  app.post("/mcp/messages", async (req, res) => {
    const sessionId = req.query["sessionId"] as string | undefined;
    if (!sessionId) {
      res.status(400).json({ error: "Missing sessionId query param" });
      return;
    }

    const transport = activeTransports.get(sessionId);
    if (!transport) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    await transport.handlePostMessage(req, res);
  });

  console.log("[MCP] SSE routes registered at /mcp/sse and /mcp/messages");
}
