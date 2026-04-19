import { db } from "../../db/client";
import { agentLogs, activityEvents } from "../../db/schema";

export async function logAgentAction(
  organizationId: string,
  agentId: string | null,
  postId: string | null,
  action: string,
  payload?: Record<string, unknown>,
): Promise<void> {
  try {
    await Promise.all([
      // Legacy table — kept for backwards compat during migration window
      db.insert(agentLogs).values({
        organizationId,
        agentId,
        postId,
        action,
        payload: payload ?? null,
      }),
      // Unified audit log — source of truth going forward
      db.insert(activityEvents).values({
        organizationId,
        actorType: "agent",
        actorId: agentId ?? organizationId,
        entityType: postId ? "post" : "agent",
        entityId: postId ?? agentId ?? organizationId,
        event: action,
        diff: payload ?? null,
      }),
    ]);
  } catch (err) {
    console.error("[AgentLogger] Failed to log action:", action, err);
  }
}

export async function logHumanAction(
  organizationId: string,
  userId: string,
  entityType: "post" | "plan" | "brand" | "agent",
  entityId: string,
  event: string,
  diff?: Record<string, unknown>,
): Promise<void> {
  try {
    await db.insert(activityEvents).values({
      organizationId,
      actorType: "human",
      actorId: userId,
      entityType,
      entityId,
      event,
      diff: diff ?? null,
    });
  } catch (err) {
    console.error("[AgentLogger] Failed to log human action:", event, err);
  }
}
