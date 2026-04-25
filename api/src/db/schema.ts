import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean,
  integer,
  numeric,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ── Enums ──────────────────────────────────────────────────────────────────────

export const platformEnum = pgEnum("platform", [
  "x",
  "instagram",
  "linkedin",
  "facebook",
  "telegram",
  "tiktok",
  "discord",
  "whatsapp",
  "slack",
  "reddit",
  "threads",
  "bluesky",
  "mastodon",
  "youtube",
  "pinterest",
  "email",
]);

export const postStatusEnum = pgEnum("post_status", [
  "draft",
  "pending_review",
  "approved",
  "scheduled",
  "published",
  "failed",
  "vetoed",
  "silenced",
]);

export const planStatusEnum = pgEnum("plan_status", [
  "generating",
  "pending_review",
  "active",
  "completed",
  "paused",
  "failed",
]);

export const planTierEnum = pgEnum("plan_tier", [
  "sandbox",
  "starter",
  "growth",
  "agency",
  "scale",
  "enterprise",
]);

export const billingIntervalEnum = pgEnum("billing_interval", ["monthly", "annual"]);

export const workflowStageEnum = pgEnum("workflow_stage", [
  "plan_review",
  "hitl",
  "legal_review",
  "analytics_only",
]);

export const actorTypeEnum = pgEnum("actor_type", ["agent", "human"]);

export const entityTypeEnum = pgEnum("entity_type", ["post", "plan", "brand", "agent"]);

export const campaignStatusEnum = pgEnum("campaign_status", ["active", "completed", "archived"]);

export const affiliateStatusEnum = pgEnum("affiliate_status", ["pending", "approved", "suspended"]);

export const conversionStatusEnum = pgEnum("conversion_status", ["pending", "cleared", "paid"]);

export const emailCampaignStatusEnum = pgEnum("email_campaign_status", ["draft", "scheduled", "sent"]);

// ── Organizations ──────────────────────────────────────────────────────────────

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  globalProhibitions: text("global_prohibitions").array().default(sql`'{}'`),
  sensitiveEventBlackouts: jsonb("sensitive_event_blackouts"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── Users ──────────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id),
  email: text("email").notNull().unique(),
  name: text("name"),
  passwordHash: text("password_hash"),
  role: text("role").notNull().default("member"), // 'owner' | 'admin' | 'member'
  isSuperAdmin: boolean("is_super_admin").default(false),
  emailVerified: boolean("email_verified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── Brand Profiles ─────────────────────────────────────────────────────────────

export const brandProfiles = pgTable("brand_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  name: text("name").notNull(),
  industry: text("industry"),
  voiceTraits: jsonb("voice_traits"),
  toneDescriptors: text("tone_descriptors").array(),
  primaryColors: text("primary_colors").array(),
  secondaryColors: text("secondary_colors").array(),
  typography: jsonb("typography"),
  qdrantCollectionId: text("qdrant_collection_id").unique(),
  sourceFiles: jsonb("source_files"),
  brandContext: jsonb("brand_context"),
  ingestStatus: text("ingest_status").default("idle"),
  bannerBearTemplateUid: text("bannerbear_template_uid"),
  logoUrl: text("logo_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── Agents (Personas) ──────────────────────────────────────────────────────────

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  brandProfileId: uuid("brand_profile_id")
    .references(() => brandProfiles.id)
    .notNull(),
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

// ── Social Accounts ────────────────────────────────────────────────────────────

export const socialAccounts = pgTable(
  "social_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    agentId: uuid("agent_id").references(() => agents.id),
    platform: platformEnum("platform").notNull(),
    accountHandle: text("account_handle").notNull(),
    accountId: text("account_id"),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    tokenExpiresAt: timestamp("token_expires_at"),
    platformConfig: jsonb("platform_config"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    orgPlatformHandleUniq: uniqueIndex("social_accounts_org_platform_handle_idx").on(
      t.organizationId,
      t.platform,
      t.accountHandle,
    ),
  }),
);

// ── Campaigns ─────────────────────────────────────────────────────────────────

export const campaigns = pgTable("campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  name: text("name").notNull(),
  goals: text("goals").array(),
  budgetCapCents: integer("budget_cap_cents"),
  status: campaignStatusEnum("status").default("active"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── Marketing Plans ────────────────────────────────────────────────────────────

export const marketingPlans = pgTable("marketing_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  brandProfileId: uuid("brand_profile_id")
    .references(() => brandProfiles.id)
    .notNull(),
  agentId: uuid("agent_id").references(() => agents.id),
  campaignId: uuid("campaign_id").references(() => campaigns.id),
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

// ── Scheduled Posts ────────────────────────────────────────────────────────────

export const scheduledPosts = pgTable("scheduled_posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  planId: uuid("plan_id")
    .references(() => marketingPlans.id)
    .notNull(),
  socialAccountId: uuid("social_account_id")
    .references(() => socialAccounts.id),
  agentId: uuid("agent_id")
    .references(() => agents.id)
    .notNull(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  brandProfileId: uuid("brand_profile_id")
    .references(() => brandProfiles.id)
    .notNull(),
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
  segments: jsonb("segments"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── Post Comments (team collaboration) ────────────────────────────────────────

export const postComments = pgTable("post_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  postId: uuid("post_id")
    .references(() => scheduledPosts.id)
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── Post Analytics ─────────────────────────────────────────────────────────────

export const postAnalytics = pgTable("post_analytics", {
  id: uuid("id").primaryKey().defaultRandom(),
  postId: uuid("post_id")
    .references(() => scheduledPosts.id)
    .notNull(),
  fetchedAt: timestamp("fetched_at").defaultNow(),
  likes: integer("likes").default(0),
  reposts: integer("reposts").default(0),
  comments: integer("comments").default(0),
  impressions: integer("impressions").default(0),
  clicks: integer("clicks").default(0),
  engagementRate: text("engagement_rate"),
  rawData: jsonb("raw_data"),
});

// ── Agent Action Logs ──────────────────────────────────────────────────────────

export const agentLogs = pgTable("agent_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  agentId: uuid("agent_id").references(() => agents.id),
  postId: uuid("post_id").references(() => scheduledPosts.id),
  action: text("action").notNull(),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── Plan Tiers ─────────────────────────────────────────────────────────────────

export const planTiers = pgTable("plan_tiers", {
  id: uuid("id").primaryKey().defaultRandom(),
  tier: planTierEnum("tier").notNull().unique(),
  displayName: text("display_name").notNull(),
  monthlyPrice: integer("monthly_price").notNull(),
  annualPrice: integer("annual_price").notNull(),
  maxBrands: integer("max_brands").notNull(),
  maxAgents: integer("max_agents").notNull(),
  maxSocialAccounts: integer("max_social_accounts").notNull(),
  maxPostsPerMonth: integer("max_posts_per_month").notNull(),
  autonomousScheduling: boolean("autonomous_scheduling").default(false),
  feedbackLoop: boolean("feedback_loop").default(false),
  aiAssetGeneration: boolean("ai_asset_generation").default(false),
  ipRotation: boolean("ip_rotation").default(false),
  whiteLabel: boolean("white_label").default(false),
  assetWatermark: boolean("asset_watermark").default(true),
  hitlRequired: boolean("hitl_required").default(false),
  guardrails: boolean("guardrails").default(false),
  agentSilence: boolean("agent_silence").default(false),
  rbac: boolean("rbac").default(false),
  maxTeamMembers: integer("max_team_members").default(1),
  overagePricePerPost: integer("overage_price_per_post").default(4),
  overagePricePerAccount: integer("overage_price_per_account").default(800),
  overagePricePerBrand: integer("overage_price_per_brand").default(2500),
});

// ── Subscriptions ──────────────────────────────────────────────────────────────

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull()
    .unique(),
  tier: planTierEnum("tier").notNull().default("sandbox"),
  billingInterval: billingIntervalEnum("billing_interval").default("monthly"),
  billingProvider: text("billing_provider").default("stripe"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripePriceId: text("stripe_price_id"),
  paystackCustomerCode: text("paystack_customer_code"),
  paystackSubscriptionCode: text("paystack_subscription_code"),
  paystackEmailToken: text("paystack_email_token"),
  paystackPlanCode: text("paystack_plan_code"),
  status: text("status").default("active"),
  trialEndsAt: timestamp("trial_ends_at"),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelledAt: timestamp("cancelled_at"),
  overageCapCents: integer("overage_cap_cents").default(5000),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── Usage Records ──────────────────────────────────────────────────────────────

export const usageRecords = pgTable("usage_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  billingPeriodStart: timestamp("billing_period_start").notNull(),
  billingPeriodEnd: timestamp("billing_period_end").notNull(),
  postsPublished: integer("posts_published").default(0),
  postsIncluded: integer("posts_included").notNull(),
  postsOverage: integer("posts_overage").default(0),
  accountsConnected: integer("accounts_connected").default(0),
  accountsIncluded: integer("accounts_included").notNull(),
  accountsOverage: integer("accounts_overage").default(0),
  brandsActive: integer("brands_active").default(0),
  brandsIncluded: integer("brands_included").notNull(),
  brandsOverage: integer("brands_overage").default(0),
  overageCostCents: integer("overage_cost_cents").default(0),
  overageInvoiced: boolean("overage_invoiced").default(false),
  teamMembersActive: integer("team_members_active").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── A/B Test Variants ──────────────────────────────────────────────────────────

export const abTestStatusEnum = pgEnum("ab_test_status", [
  "running",
  "completed",
  "winner_promoted",
]);

export const abTests = pgTable("ab_tests", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  postAId: uuid("post_a_id").references(() => scheduledPosts.id).notNull(),
  postBId: uuid("post_b_id").references(() => scheduledPosts.id).notNull(),
  winnerId: uuid("winner_id").references(() => scheduledPosts.id),
  status: abTestStatusEnum("status").default("running"),
  promotedAt: timestamp("promoted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── Webhook Endpoints ──────────────────────────────────────────────────────────

export const webhookEndpoints = pgTable("webhook_endpoints", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  url: text("url").notNull(),
  events: text("events").array().default(sql`'{}'`),
  channels: text("channels").array().default(sql`'{}'`),
  secret: text("secret"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── Workflow Participants (RBAC) ───────────────────────────────────────────────

export const workflowParticipants = pgTable("workflow_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  brandProfileId: uuid("brand_profile_id").references(() => brandProfiles.id),
  agentId: uuid("agent_id").references(() => agents.id),
  stage: workflowStageEnum("stage").notNull(),
  canEdit: boolean("can_edit").default(false),
  canVeto: boolean("can_veto").default(false),
  notifyOn: text("notify_on").array().default(sql`'{}'`),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── Activity Events (Unified Audit Log) ───────────────────────────────────────

export const activityEvents = pgTable("activity_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  actorType: actorTypeEnum("actor_type").notNull(),
  actorId: uuid("actor_id").notNull(),
  entityType: entityTypeEnum("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  event: text("event").notNull(),
  diff: jsonb("diff"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── Feature Flags ──────────────────────────────────────────────────────────────

export const featureFlags = pgTable("feature_flags", {
  id: uuid("id").primaryKey().defaultRandom(),
  flagName: text("flag_name").notNull().unique(),
  enabledGlobally: boolean("enabled_globally").default(false),
  enabledForOrgs: text("enabled_for_orgs").array().default(sql`'{}'`),
  disabledForOrgs: text("disabled_for_orgs").array().default(sql`'{}'`),
});

// ── Affiliates ─────────────────────────────────────────────────────────────────

export const affiliates = pgTable("affiliates", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  status: affiliateStatusEnum("status").default("pending"),
  commissionRate: numeric("commission_rate", { precision: 5, scale: 4 }).default("0.20"),
  totalEarnedCents: integer("total_earned_cents").default(0),
  totalPaidCents: integer("total_paid_cents").default(0),
  payoutThresholdCents: integer("payout_threshold_cents").default(5000),
  stripeAccountId: text("stripe_account_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const affiliateLinks = pgTable("affiliate_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  affiliateId: uuid("affiliate_id").references(() => affiliates.id).notNull(),
  code: text("code").notNull().unique(),
  campaign: text("campaign"),
  clicks: integer("clicks").default(0),
  conversions: integer("conversions").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const affiliateConversions = pgTable("affiliate_conversions", {
  id: uuid("id").primaryKey().defaultRandom(),
  affiliateLinkId: uuid("affiliate_link_id").references(() => affiliateLinks.id).notNull(),
  convertedOrgId: uuid("converted_org_id").references(() => organizations.id),
  planTier: text("plan_tier").notNull(),
  commissionCents: integer("commission_cents").notNull(),
  status: conversionStatusEnum("status").default("pending"),
  clearedAt: timestamp("cleared_at"),
  paidAt: timestamp("paid_at"),
});

// ── Promo Codes ────────────────────────────────────────────────────────────────

export const promoCodes = pgTable("promo_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  discountType: text("discount_type").notNull(), // 'percent' | 'fixed_cents'
  discountValue: integer("discount_value").notNull(),
  applicableTiers: text("applicable_tiers").array(),
  maxUses: integer("max_uses"),
  usedCount: integer("used_count").default(0),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").default(true),
  stripeCouponId: text("stripe_coupon_id"),
  paystackPlanCode: text("paystack_plan_code"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── Email Campaigns ────────────────────────────────────────────────────────────

export const emailCampaigns = pgTable("email_campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  brandProfileId: uuid("brand_profile_id").references(() => brandProfiles.id),
  subject: text("subject").notNull(),
  previewText: text("preview_text"),
  htmlBody: text("html_body").notNull(),
  plainText: text("plain_text"),
  recipientList: text("recipient_list").array().default(sql`'{}'`),
  status: emailCampaignStatusEnum("status").default("draft"),
  scheduledAt: timestamp("scheduled_at"),
  sentAt: timestamp("sent_at"),
  opens: integer("opens").default(0),
  clicks: integer("clicks").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── RSS Feeds ──────────────────────────────────────────────────────────────────

export const rssFeeds = pgTable("rss_feeds", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  brandProfileId: uuid("brand_profile_id").references(() => brandProfiles.id),
  feedUrl: text("feed_url").notNull(),
  label: text("label").notNull(),
  lastFetchedAt: timestamp("last_fetched_at"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const feedItems = pgTable("feed_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  rssFeedId: uuid("rss_feed_id").references(() => rssFeeds.id).notNull(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  title: text("title"),
  url: text("url"),
  summary: text("summary"),
  publishedAt: timestamp("published_at"),
  isFlagged: boolean("is_flagged").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});
