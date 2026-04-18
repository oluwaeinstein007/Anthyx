export const CREDIT_COSTS = {
  TEXT_POST: 1,
  TEMPLATE_CARD: 1,
  AI_IMAGE: 5,
  BRAND_ANALYSIS: 50,
  PLAN_GENERATION: 20,
  WEB_SEARCH_CALL: 2,
} as const;

export type CreditAction = keyof typeof CREDIT_COSTS;
