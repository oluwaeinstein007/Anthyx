import type { Platform } from "./platforms";
import type { GeneratedPlanItem } from "./agents";

export type PlanStatus = "generating" | "pending_review" | "active" | "completed" | "paused";

export type PostStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "scheduled"
  | "published"
  | "failed"
  | "vetoed"
  | "silenced";

export interface MarketingPlan {
  id: string;
  organizationId: string;
  brandProfileId: string;
  agentId?: string | null;
  name: string;
  status: PlanStatus;
  startDate: Date;
  endDate: Date;
  generationPrompt?: string | null;
  industryContext?: string | null;
  goals?: string[] | null;
  feedbackLoopEnabled?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScheduledPost {
  id: string;
  planId: string;
  socialAccountId: string;
  agentId: string;
  contentText: string;
  contentHashtags?: string[] | null;
  mediaUrls?: string[] | null;
  scheduledAt: Date;
  status: PostStatus;
  platform: Platform;
  bullJobId?: string | null;
  publishedAt?: Date | null;
  platformPostId?: string | null;
  errorMessage?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: Date | null;
  reviewNotes?: string | null;
  assetTrack?: "template" | "ai";
  suggestedMediaPrompt?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PostAnalytics {
  id: string;
  postId: string;
  fetchedAt: Date;
  likes: number;
  reposts: number;
  comments: number;
  impressions: number;
  clicks: number;
  engagementRate: string;
  rawData?: Record<string, unknown> | null;
}

export interface PlanGenerationRequest {
  brandProfileId: string;
  agentId: string;
  platforms: Platform[];
  goals: string[];
  startDate: string;
  feedbackLoopEnabled?: boolean;
}

export { type GeneratedPlanItem };
