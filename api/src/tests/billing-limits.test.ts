import { describe, it, expect, vi, beforeEach } from "vitest";
import { PlanLimitError, PlanLimitsEnforcer } from "../services/billing/limits";

// Mock DB and dependencies so tests run without a real database
vi.mock("../db/client", () => ({
  db: {
    query: {
      subscriptions: { findFirst: vi.fn() },
      planTiers: { findFirst: vi.fn() },
    },
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(),
      })),
    })),
  },
}));

vi.mock("../services/billing/usage-tracker", () => ({
  getCurrentUsage: vi.fn(),
}));

import { db } from "../db/client";
import { getCurrentUsage } from "../services/billing/usage-tracker";

const mockFindFirst = db.query.subscriptions.findFirst as ReturnType<typeof vi.fn>;
const mockTierFindFirst = db.query.planTiers.findFirst as ReturnType<typeof vi.fn>;
const mockGetUsage = getCurrentUsage as ReturnType<typeof vi.fn>;

function makeSelect(result: number) {
  return vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn().mockResolvedValue([{ value: result }]),
    })),
  }));
}

describe("PlanLimitError", () => {
  it("has correct name and limitType", () => {
    const err = new PlanLimitError("brands", "Too many brands");
    expect(err.name).toBe("PlanLimitError");
    expect(err.limitType).toBe("brands");
    expect(err.message).toBe("Too many brands");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("PlanLimitsEnforcer.check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows when no subscription exists", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(PlanLimitsEnforcer.check("org-1", "brand")).resolves.toBeUndefined();
  });

  it("allows when no tier record exists", async () => {
    mockFindFirst.mockResolvedValue({ tier: "pro", organizationId: "org-1" });
    mockTierFindFirst.mockResolvedValue(null);
    await expect(PlanLimitsEnforcer.check("org-1", "brand")).resolves.toBeUndefined();
  });

  it("allows brand creation when under limit", async () => {
    mockFindFirst.mockResolvedValue({ tier: "starter", organizationId: "org-1" });
    mockTierFindFirst.mockResolvedValue({ maxBrands: 3, maxAgents: 2, maxSocialAccounts: 5, maxPostsPerMonth: 100, overagePricePerPost: 10 });
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([{ value: 2 }]),
      })),
    });
    await expect(PlanLimitsEnforcer.check("org-1", "brand")).resolves.toBeUndefined();
  });

  it("throws PlanLimitError when brands at limit", async () => {
    mockFindFirst.mockResolvedValue({ tier: "starter", organizationId: "org-1" });
    mockTierFindFirst.mockResolvedValue({ maxBrands: 3, maxAgents: 2, maxSocialAccounts: 5, maxPostsPerMonth: 100, overagePricePerPost: 10 });
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([{ value: 3 }]),
      })),
    });
    await expect(PlanLimitsEnforcer.check("org-1", "brand")).rejects.toThrow(PlanLimitError);
    await expect(PlanLimitsEnforcer.check("org-1", "brand")).rejects.toMatchObject({ limitType: "brands" });
  });

  it("allows unlimited brands when maxBrands is -1", async () => {
    mockFindFirst.mockResolvedValue({ tier: "agency", organizationId: "org-1" });
    mockTierFindFirst.mockResolvedValue({ maxBrands: -1, maxAgents: -1, maxSocialAccounts: -1, maxPostsPerMonth: -1, overagePricePerPost: 0 });
    await expect(PlanLimitsEnforcer.check("org-1", "brand")).resolves.toBeUndefined();
  });

  it("allows post when within included quota", async () => {
    mockFindFirst.mockResolvedValue({ tier: "pro", organizationId: "org-1" });
    mockTierFindFirst.mockResolvedValue({ maxBrands: -1, maxAgents: -1, maxSocialAccounts: -1, maxPostsPerMonth: 200, overagePricePerPost: 5 });
    mockGetUsage.mockResolvedValue({ postsPublished: 50, postsIncluded: 200 });
    await expect(PlanLimitsEnforcer.check("org-1", "post")).resolves.toBeUndefined();
  });

  it("throws when post overage cap exceeded", async () => {
    mockFindFirst
      .mockResolvedValueOnce({ tier: "starter", organizationId: "org-1" })
      .mockResolvedValueOnce({ tier: "starter", organizationId: "org-1", overageCapCents: 500 });
    mockTierFindFirst.mockResolvedValue({ maxBrands: 3, maxAgents: 2, maxSocialAccounts: 5, maxPostsPerMonth: 30, overagePricePerPost: 100 });
    // 30 published, 30 included → overage for next post = (30-30+1)*100 = 100 cents, cap = 500 cents → no throw
    mockGetUsage.mockResolvedValue({ postsPublished: 34, postsIncluded: 30 });
    // (34-30+1)*100 = 500 cents = cap → throw
    await expect(PlanLimitsEnforcer.check("org-1", "post")).rejects.toThrow(PlanLimitError);
  });
});
