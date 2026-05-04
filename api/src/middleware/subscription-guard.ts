import type { Request, Response, NextFunction } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "../db/client";
import { subscriptions, scheduledPosts } from "../db/schema";

/**
 * Blocks non-GET requests from orgs in suspended state.
 * Also auto-transitions grace_period → suspended when the grace window expires.
 * Apply to any route that mutates data (posts, plans, brands, etc.).
 */
export async function requireActiveSubscription(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.user?.orgId) { next(); return; }

  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.organizationId, req.user.orgId),
  });

  if (!sub) { next(); return; } // sandbox / no subscription → allow

  // Auto-expire grace period
  if (
    sub.status === "grace_period" &&
    sub.gracePeriodEndsAt &&
    sub.gracePeriodEndsAt < new Date()
  ) {
    await db
      .update(subscriptions)
      .set({ status: "suspended", updatedAt: new Date() })
      .where(eq(subscriptions.organizationId, req.user.orgId));

    await db
      .update(scheduledPosts)
      .set({ status: "paused", updatedAt: new Date() })
      .where(
        and(
          eq(scheduledPosts.organizationId, req.user.orgId),
          inArray(scheduledPosts.status, ["scheduled", "approved"]),
        ),
      );

    sub.status = "suspended";
  }

  if (sub.status === "suspended") {
    res.status(402).json({
      error: "Your subscription has lapsed. Reactivate to resume posting.",
      code: "SUBSCRIPTION_SUSPENDED",
    });
    return;
  }

  next();
}
