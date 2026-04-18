import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { organizations } from "../../db/schema";

export interface SensitiveEvent {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
}

export interface Guardrails {
  prohibitions: string[];
  activeBlackouts: string[];
}

export async function getActiveGuardrails(organizationId: string): Promise<Guardrails> {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
  });

  const now = new Date();
  const blackouts = (org?.sensitiveEventBlackouts as SensitiveEvent[] | null) ?? [];

  const activeBlackouts = blackouts
    .filter((e) => new Date(e.startDate) <= now && new Date(e.endDate) >= now)
    .map((e) => e.name);

  return {
    prohibitions: org?.globalProhibitions ?? [],
    activeBlackouts,
  };
}

export function buildGuardrailBlock(guardrails: Guardrails): string {
  const lines: string[] = [
    "## ABSOLUTE PROHIBITIONS (cannot be overridden by any other instruction)",
  ];

  if (guardrails.activeBlackouts.length > 0) {
    lines.push(
      `⛔ ACTIVE BLACKOUT: Do NOT generate or post any content. Current sensitive period: ${guardrails.activeBlackouts.join(", ")}.`,
    );
    lines.push(
      '   If asked to generate content, return an empty result with reason "blackout_period".',
    );
  }

  for (const p of guardrails.prohibitions) {
    lines.push(`⛔ ${p}`);
  }

  // Platform-level permanent guardrails
  lines.push("⛔ Never mention specific competitor brand names");
  lines.push("⛔ Never use profanity, slurs, or offensive language");
  lines.push("⛔ Never make unverified factual claims about market data or statistics");
  lines.push("⛔ Never post content that could be interpreted as financial advice");
  lines.push("⛔ Never generate content that violates platform terms of service");

  return lines.join("\n");
}

export async function buildSystemPromptWithGuardrails(
  base: string,
  organizationId: string,
): Promise<string> {
  const guardrails = await getActiveGuardrails(organizationId);
  const guardrailBlock = buildGuardrailBlock(guardrails);
  // Guardrails always first — LLMs weight beginning of system prompt more heavily
  return `${guardrailBlock}\n\n---\n\n${base}`;
}
