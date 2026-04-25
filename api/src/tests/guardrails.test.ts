import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildGuardrailBlock, getActiveGuardrails } from "../services/agent/guardrails";
import type { Guardrails, SensitiveEvent } from "../services/agent/guardrails";

vi.mock("../db/client", () => ({
  db: {
    query: {
      organizations: { findFirst: vi.fn() },
    },
  },
}));

import { db } from "../db/client";

const mockOrgFindFirst = db.query.organizations.findFirst as ReturnType<typeof vi.fn>;

describe("buildGuardrailBlock", () => {
  it("always includes platform-level guardrails", () => {
    const block = buildGuardrailBlock({ prohibitions: [], activeBlackouts: [] });
    expect(block).toContain("ABSOLUTE PROHIBITIONS");
    expect(block).toContain("competitor brand names");
    expect(block).toContain("profanity");
    expect(block).toContain("financial advice");
  });

  it("includes custom prohibitions", () => {
    const block = buildGuardrailBlock({
      prohibitions: ["Never mention alcohol", "No political content"],
      activeBlackouts: [],
    });
    expect(block).toContain("Never mention alcohol");
    expect(block).toContain("No political content");
  });

  it("includes active blackout warning", () => {
    const block = buildGuardrailBlock({
      prohibitions: [],
      activeBlackouts: ["Memorial Day", "Election Period"],
    });
    expect(block).toContain("ACTIVE BLACKOUT");
    expect(block).toContain("Memorial Day");
    expect(block).toContain("Election Period");
    expect(block).toContain("blackout_period");
  });

  it("does not include blackout text when no active blackouts", () => {
    const block = buildGuardrailBlock({ prohibitions: [], activeBlackouts: [] });
    expect(block).not.toContain("ACTIVE BLACKOUT");
  });
});

describe("getActiveGuardrails", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns empty guardrails when org not found", async () => {
    mockOrgFindFirst.mockResolvedValue(null);
    const result = await getActiveGuardrails("org-missing");
    expect(result.prohibitions).toEqual([]);
    expect(result.activeBlackouts).toEqual([]);
  });

  it("returns org prohibitions", async () => {
    mockOrgFindFirst.mockResolvedValue({
      id: "org-1",
      globalProhibitions: ["No competitor mentions", "No price claims"],
      sensitiveEventBlackouts: [],
    });
    const result = await getActiveGuardrails("org-1");
    expect(result.prohibitions).toEqual(["No competitor mentions", "No price claims"]);
  });

  it("marks event as active blackout when date falls within range", async () => {
    const now = new Date();
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);

    const events: SensitiveEvent[] = [
      {
        id: "e1",
        name: "Product Launch Freeze",
        startDate: yesterday.toISOString().slice(0, 10),
        endDate: tomorrow.toISOString().slice(0, 10),
      },
    ];

    mockOrgFindFirst.mockResolvedValue({
      id: "org-1",
      globalProhibitions: [],
      sensitiveEventBlackouts: events,
    });

    const result = await getActiveGuardrails("org-1");
    expect(result.activeBlackouts).toContain("Product Launch Freeze");
  });

  it("does not mark past events as active", async () => {
    const events: SensitiveEvent[] = [
      {
        id: "e2",
        name: "Past Event",
        startDate: "2020-01-01",
        endDate: "2020-01-05",
      },
    ];

    mockOrgFindFirst.mockResolvedValue({
      id: "org-1",
      globalProhibitions: [],
      sensitiveEventBlackouts: events,
    });

    const result = await getActiveGuardrails("org-1");
    expect(result.activeBlackouts).not.toContain("Past Event");
  });

  it("does not mark future events as active", async () => {
    const events: SensitiveEvent[] = [
      {
        id: "e3",
        name: "Future Event",
        startDate: "2099-01-01",
        endDate: "2099-01-05",
      },
    ];

    mockOrgFindFirst.mockResolvedValue({
      id: "org-1",
      globalProhibitions: [],
      sensitiveEventBlackouts: events,
    });

    const result = await getActiveGuardrails("org-1");
    expect(result.activeBlackouts).not.toContain("Future Event");
  });
});
