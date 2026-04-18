import type { Request, Response, NextFunction } from "express";
import { PlanLimitsEnforcer, PlanLimitError } from "../services/billing/limits";

type LimitAction = "brand" | "agent" | "account" | "post";

export function requireLimit(action: LimitAction) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await PlanLimitsEnforcer.check(req.user.orgId, action);
      next();
    } catch (err) {
      if (err instanceof PlanLimitError) {
        return res.status(402).json({
          error: "Plan limit reached",
          limitType: err.limitType,
          message: err.message,
        });
      }
      next(err);
    }
  };
}
