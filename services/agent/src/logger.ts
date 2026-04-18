import { db } from "./db.js";
import { agentLogs } from "./schema.js";

export async function logAgentAction(
  organizationId: string,
  agentId: string | null,
  postId: string | null,
  action: string,
  payload?: Record<string, unknown>,
): Promise<void> {
  try {
    await db.insert(agentLogs).values({ organizationId, agentId, postId, action, payload: payload ?? null });
  } catch (err) {
    console.error("[AgentLogger] Failed to log action:", action, err);
  }
}
