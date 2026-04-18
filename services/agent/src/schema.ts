import {
  pgTable, uuid, text, timestamp, jsonb, boolean, integer, pgEnum,
} from "drizzle-orm/pg-core";

export const platformEnum = pgEnum("platform", ["x", "instagram", "linkedin", "facebook", "telegram", "tiktok"]);
export const postStatusEnum = pgEnum("post_status", ["draft", "pending_review", "approved", "scheduled", "published", "failed", "vetoed", "silenced"]);
export const planStatusEnum = pgEnum("plan_status", ["generating", "pending_review", "active", "completed", "paused"]);

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  globalProhibitions: text("global_prohibitions").array().default([]),
  sensitiveEventBlackouts: jsonb("sensitive_event_blackouts"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const brandProfiles = pgTable("brand_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  name: text("name").notNull(),
  industry: text("industry"),
  voiceTraits: jsonb("voice_traits"),
  toneDescriptors: text("tone_descriptors").array(),
  primaryColors: text("primary_colors").array(),
  secondaryColors: text("secondary_colors").array(),
  typography: jsonb("typography"),
  qdrantCollectionId: text("qdrant_collection_id").unique(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  brandProfileId: uuid("brand_profile_id").references(() => brandProfiles.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  dietInstructions: text("diet_instructions"),
  systemPromptOverride: text("system_prompt_override"),
  isActive: boolean("is_active").default(true),
  silencedAt: timestamp("silenced_at"),
  silenceReason: text("silence_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id),
  email: text("email").notNull().unique(),
  name: text("name"),
  role: text("role").notNull().default("member"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const socialAccounts = pgTable("social_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  agentId: uuid("agent_id").references(() => agents.id),
  platform: platformEnum("platform").notNull(),
  accountHandle: text("account_handle").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const marketingPlans = pgTable("marketing_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  brandProfileId: uuid("brand_profile_id").references(() => brandProfiles.id).notNull(),
  agentId: uuid("agent_id").references(() => agents.id),
  name: text("name").notNull(),
  status: planStatusEnum("status").default("generating"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  generationPrompt: text("generation_prompt"),
  industryContext: text("industry_context"),
  goals: text("goals").array(),
  feedbackLoopEnabled: boolean("feedback_loop_enabled").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const scheduledPosts = pgTable("scheduled_posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  planId: uuid("plan_id").references(() => marketingPlans.id).notNull(),
  socialAccountId: uuid("social_account_id").references(() => socialAccounts.id).notNull(),
  agentId: uuid("agent_id").references(() => agents.id).notNull(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  brandProfileId: uuid("brand_profile_id").references(() => brandProfiles.id).notNull(),
  platform: platformEnum("platform").notNull(),
  contentText: text("content_text").notNull(),
  contentType: text("content_type"),
  contentHashtags: text("content_hashtags").array(),
  mediaUrls: text("media_urls").array(),
  scheduledAt: timestamp("scheduled_at").notNull(),
  status: postStatusEnum("status").default("draft"),
  bullJobId: text("bull_job_id"),
  publishedAt: timestamp("published_at"),
  platformPostId: text("platform_post_id"),
  errorMessage: text("error_message"),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  assetTrack: text("asset_track").default("template"),
  suggestedMediaPrompt: text("suggested_media_prompt"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const agentLogs = pgTable("agent_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  agentId: uuid("agent_id").references(() => agents.id),
  postId: uuid("post_id").references(() => scheduledPosts.id),
  action: text("action").notNull(),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at").defaultNow(),
});
