import { eq } from "drizzle-orm";
import { db } from "../db";
import { agents } from "../schema";

export async function retrieveDietInstructions(args: { agentId: string }): Promise<string> {
  const agent = await db.query.agents.findFirst({ where: eq(agents.id, args.agentId) });
  if (!agent) throw new Error(`Agent ${args.agentId} not found`);

  return JSON.stringify({
    instructions: agent.dietInstructions ?? "No specific diet instructions.",
    prohibitions: agent.dietInstructions
      ? agent.dietInstructions.split("\n").filter((l) => l.startsWith("-"))
      : [],
    systemPromptOverride: agent.systemPromptOverride ?? null,
  });
}
