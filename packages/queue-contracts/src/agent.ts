export interface PlanJobPayload {
  planId: string;
  organizationId: string;
  brandProfileId: string;
  brandName: string;
  industry: string;
  goals: string[];
  platforms: string[];
  agentId: string;
  socialAccountIds: string[];
  feedbackLoopEnabled?: boolean;
}

export interface ContentJobPayload {
  planId: string;
  organizationId: string;
}

export interface AnalyticsJobPayload {
  postId: string;
}
