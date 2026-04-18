import { and, eq, count } from "drizzle-orm";
import { db } from "../../db/client";
import {
  subscriptions,
  planTiers,
  brandProfiles,
  agents,
  socialAccounts,
} from "../../db/schema";
import { getCurrentUsage } from "./usage-tracker";

export class PlanLimitError extends Error {
  constructor(
    public readonly limitType: "brands" | "agents" | "accounts" | "posts",
    message: string,
  ) {
    super(message);
    this.name = "PlanLimitError";
  }
}

export class PlanLimitsEnforcer {
  static async check(
    organizationId: string,
    resource: "brand" | "agent" | "account" | "post",
  ): Promise<void> {
    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.organizationId, organizationId),
    });

    if (!sub) throw new Error("No subscription found");

    const tier = await db.query.planTiers.findFirst({
      where: eq(planTiers.tier, sub.tier),
    });

    if (!tier) throw new Error("Plan tier not found");

    switch (resource) {
      case "brand": {
        if (tier.maxBrands === -1) return; // unlimited
        const [{ value: brandCount }] = await db
          .select({ value: count() })
          .from(brandProfiles)
          .where(eq(brandProfiles.organizationId, organizationId));
        if ((brandCount ?? 0) >= tier.maxBrands) {
          throw new PlanLimitError(
            "brands",
            `Your ${sub.tier} plan allows ${tier.maxBrands} brand(s). Upgrade to add more.`,
          );
        }
        break;
      }
      case "agent": {
        if (tier.maxAgents === -1) return;
        const [{ value: agentCount }] = await db
          .select({ value: count() })
          .from(agents)
          .where(eq(agents.organizationId, organizationId));
        if ((agentCount ?? 0) >= tier.maxAgents) {
          throw new PlanLimitError(
            "agents",
            `Your ${sub.tier} plan allows ${tier.maxAgents} agent(s). Upgrade to add more.`,
          );
        }
        break;
      }
      case "account": {
        if (tier.maxSocialAccounts === -1) return;
        const [{ value: accountCount }] = await db
          .select({ value: count() })
          .from(socialAccounts)
          .where(
            and(
              eq(socialAccounts.organizationId, organizationId),
              eq(socialAccounts.isActive, true),
            ),
          );
        if ((accountCount ?? 0) >= tier.maxSocialAccounts) {
          throw new PlanLimitError(
            "accounts",
            `Your ${sub.tier} plan allows ${tier.maxSocialAccounts} social account(s). Upgrade to connect more.`,
          );
        }
        break;
      }
      case "post": {
        const usage = await getCurrentUsage(organizationId);
        if (!usage) return;
        const published = usage.postsPublished ?? 0;
        const included = usage.postsIncluded ?? 0;
        if (tier.maxPostsPerMonth === -1) return;
        // Check overage cap
        if (published >= included) {
          const overageCost = ((published - included) + 1) * tier.overagePricePerPost;
          const sub2 = await db.query.subscriptions.findFirst({
            where: eq(subscriptions.organizationId, organizationId),
          });
          if (sub2?.overageCapCents && overageCost > sub2.overageCapCents) {
            throw new PlanLimitError(
              "posts",
              `Monthly post overage cap of $${((sub2.overageCapCents ?? 0) / 100).toFixed(2)} reached. Raise your cap or upgrade.`,
            );
          }
        }
        break;
      }
    }
  }
}
