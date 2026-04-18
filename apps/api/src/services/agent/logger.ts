import { db } from "../../db/client";
import { agentLogs } from "../../db/schema";

export async function logAgentAction(
  organizationId: string,
  agentId: string | null,
  postId: string | null,
  action: string,
  payload?: Record<string, unknown>,
): Promise<void> {
  try {
    await db.insert(agentLogs).values({
      organizationId,
      agentId,
      postId,
      action,
      payload: payload ?? null,
    });
  } catch (err) {
    // Never let logging failures break the main flow
    console.error("[AgentLogger] Failed to log action:", action, err);
  }
}
