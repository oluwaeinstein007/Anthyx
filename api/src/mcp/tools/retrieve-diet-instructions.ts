import { z } from "zod";
import { db } from "../../db/client";
import { agents } from "../../db/schema";
import { eq } from "drizzle-orm";

export const retrieveDietInstructionsTool = {
  name: "retrieve_diet_instructions",
  description:
    "Retrieve an agent's diet instructions (behavioral overrides) and system prompt override. Used by the Reviewer agent to enforce persona compliance.",
  inputSchema: z.object({
    agentId: z.string().uuid(),
  }),
  async handler({ agentId }: { agentId: string }) {
    const agent = await db.query.agents.findFirst({
      where: eq(agents.id, agentId),
    });

    if (!agent) throw new Error(`Agent ${agentId} not found`);

    return {
      instructions: agent.dietInstructions ?? "No specific diet instructions.",
      prohibitions: agent.dietInstructions
        ? agent.dietInstructions.split("\n").filter((l) => l.startsWith("-"))
        : [],
      systemPromptOverride: agent.systemPromptOverride ?? null,
    };
  },
};
