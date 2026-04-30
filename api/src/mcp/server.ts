import type { Express } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import type { z } from "zod";
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

// The MCP SDK's registerTool<OutputArgs, InputArgs> hits TypeScript's type
// instantiation depth limit (TS2589) when called with generic ZodObject types.
// We break the inference chain with a loose alias that's still structurally safe.
type LooseRegisterTool = (
  name: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: { description?: string; inputSchema?: any },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cb: (args: any) => Promise<{ content: { type: string; text: string }[] }>,
) => void;

function registerMcpTool(
  server: McpServer,
  tool: {
    name: string;
    description: string;
    inputSchema: z.ZodTypeAny;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler: (args: any) => Promise<unknown>;
  },
) {
  (server.registerTool as unknown as LooseRegisterTool)(
    tool.name,
    { description: tool.description, inputSchema: tool.inputSchema },
    async (args) => ({
      content: [{ type: "text", text: JSON.stringify(await tool.handler(args)) }],
    }),
  );
}

// Strategist tools
registerMcpTool(mcpServer, retrieveBrandContextTool);
registerMcpTool(mcpServer, webSearchTrendsTool);
registerMcpTool(mcpServer, readEngagementAnalyticsTool);

// Copywriter tools
registerMcpTool(mcpServer, retrieveBrandVoiceTool);
registerMcpTool(mcpServer, generateImageAssetTool);

// Reviewer tools
registerMcpTool(mcpServer, retrieveDietInstructionsTool);
registerMcpTool(mcpServer, retrieveBrandRulesTool);

// Shared
registerMcpTool(mcpServer, schedulePostTool);

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
