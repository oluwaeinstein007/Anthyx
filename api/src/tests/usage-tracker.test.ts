import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../db/client", () => ({
  db: {
    query: {
      subscriptions: { findFirst: vi.fn() },
      planTiers: { findFirst: vi.fn() },
      usageRecords: { findFirst: vi.fn() },
    },
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([]),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{
          id: "rec-1",
          postsPublished: 0,
          postsIncluded: 30,
          accountsIncluded: 5,
          brandsIncluded: 3,
        }]),
      })),
    })),
  },
}));

vi.mock("../queue/client", () => ({
  notificationQueue: {
    add: vi.fn().mockResolvedValue(undefined),
  },
}));

import { db } from "../db/client";
import { notificationQueue } from "../queue/client";
import { incrementPost, getCurrentUsage } from "../services/billing/usage-tracker";

const mockSubFind = db.query.subscriptions.findFirst as ReturnType<typeof vi.fn>;
const mockTierFind = db.query.planTiers.findFirst as ReturnType<typeof vi.fn>;
const mockUsageFind = db.query.usageRecords.findFirst as ReturnType<typeof vi.fn>;
const mockNotifyAdd = notificationQueue.add as ReturnType<typeof vi.fn>;

describe("getCurrentUsage", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns null when no subscription", async () => {
    mockSubFind.mockResolvedValue(null);
    const result = await getCurrentUsage("org-1");
    expect(result).toBeNull();
  });

  it("returns null when subscription has no period dates", async () => {
    mockSubFind.mockResolvedValue({ id: "sub-1" });
    const result = await getCurrentUsage("org-1");
    expect(result).toBeNull();
  });

  it("returns usage record when found", async () => {
    mockSubFind.mockResolvedValue({
      id: "sub-1",
      currentPeriodStart: new Date("2026-04-01"),
      currentPeriodEnd: new Date("2026-04-30"),
    });
    const expectedRecord = { id: "rec-1", postsPublished: 10, postsIncluded: 30 };
    mockUsageFind.mockResolvedValue(expectedRecord);

    const result = await getCurrentUsage("org-1");
    expect(result).toEqual(expectedRecord);
  });
});

describe("incrementPost", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("does nothing when no subscription", async () => {
    mockSubFind.mockResolvedValue(null);
    await expect(incrementPost("org-1")).resolves.toBeUndefined();
    expect(db.update).not.toHaveBeenCalled();
  });

  it("does nothing when subscription has no period dates", async () => {
    mockSubFind.mockResolvedValue({ id: "sub-1" });
    await expect(incrementPost("org-1")).resolves.toBeUndefined();
  });

  it("increments postsPublished in existing record", async () => {
    const periodStart = new Date("2026-04-01");
    const periodEnd = new Date("2026-04-30");
    mockSubFind.mockResolvedValue({
      id: "sub-1",
      tier: "pro",
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    });
    mockUsageFind.mockResolvedValue({
      id: "rec-1",
      postsPublished: 5,
      postsIncluded: 30,
      billingPeriodStart: periodStart,
      billingPeriodEnd: periodEnd,
    });

    const mockSet = vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) }));
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: mockSet });

    await incrementPost("org-1");
    expect(db.update).toHaveBeenCalled();
    const calls = mockSet.mock.calls as unknown as [Record<string, unknown>][];
    const setCall = calls[0]![0]!;
    expect(setCall["postsPublished"]).toBe(6);
    expect(setCall["postsOverage"]).toBe(0);
  });

  it("enqueues quota_warning at 80% threshold", async () => {
    const periodStart = new Date("2026-04-01");
    const periodEnd = new Date("2026-04-30");
    mockSubFind.mockResolvedValue({
      id: "sub-1", tier: "pro",
      currentPeriodStart: periodStart, currentPeriodEnd: periodEnd,
    });
    // 23/30 = 76.6%, next will be 24/30 = 80% → trigger warning
    mockUsageFind.mockResolvedValue({
      id: "rec-1", postsPublished: 23, postsIncluded: 30,
      billingPeriodStart: periodStart, billingPeriodEnd: periodEnd,
    });

    const mockSet = vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) }));
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: mockSet });

    await incrementPost("org-1");
    expect(mockNotifyAdd).toHaveBeenCalledWith("usage-alert", expect.objectContaining({
      type: "quota_warning",
      thresholdPct: 80,
    }));
  });

  it("enqueues quota_reached at 100% threshold", async () => {
    const periodStart = new Date("2026-04-01");
    const periodEnd = new Date("2026-04-30");
    mockSubFind.mockResolvedValue({
      id: "sub-1", tier: "pro",
      currentPeriodStart: periodStart, currentPeriodEnd: periodEnd,
    });
    // 29/30 = 96.6%, next will be 30/30 = 100% → trigger reached
    mockUsageFind.mockResolvedValue({
      id: "rec-1", postsPublished: 29, postsIncluded: 30,
      billingPeriodStart: periodStart, billingPeriodEnd: periodEnd,
    });

    const mockSet = vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) }));
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: mockSet });

    await incrementPost("org-1");
    expect(mockNotifyAdd).toHaveBeenCalledWith("usage-alert", expect.objectContaining({
      type: "quota_reached",
      thresholdPct: 100,
    }));
  });
});
