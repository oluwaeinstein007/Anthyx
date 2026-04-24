-- Add new enum values to platform
ALTER TYPE "platform" ADD VALUE IF NOT EXISTS 'pinterest';
--> statement-breakpoint
ALTER TYPE "platform" ADD VALUE IF NOT EXISTS 'email';
--> statement-breakpoint

-- Add campaign_status enum
DO $$ BEGIN
 CREATE TYPE "campaign_status" AS ENUM('active', 'completed', 'archived');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- Add affiliate_status enum
DO $$ BEGIN
 CREATE TYPE "affiliate_status" AS ENUM('pending', 'approved', 'suspended');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- Add conversion_status enum
DO $$ BEGIN
 CREATE TYPE "conversion_status" AS ENUM('pending', 'cleared', 'paid');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- Add email_campaign_status enum
DO $$ BEGIN
 CREATE TYPE "email_campaign_status" AS ENUM('draft', 'scheduled', 'sent');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- Add is_super_admin and email_verified to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_super_admin" BOOLEAN DEFAULT FALSE;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified" BOOLEAN DEFAULT FALSE;
--> statement-breakpoint

-- Add status, start_date, end_date to campaigns
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "status" "campaign_status" DEFAULT 'active';
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "start_date" TIMESTAMPTZ;
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "end_date" TIMESTAMPTZ;
--> statement-breakpoint

-- Feature flags table
CREATE TABLE IF NOT EXISTS "feature_flags" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "flag_name" TEXT NOT NULL UNIQUE,
  "enabled_globally" BOOLEAN DEFAULT FALSE,
  "enabled_for_orgs" TEXT[] DEFAULT '{}',
  "disabled_for_orgs" TEXT[] DEFAULT '{}'
);
--> statement-breakpoint

-- Post comments (reviewer collaboration)
CREATE TABLE IF NOT EXISTS "post_comments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "post_id" UUID NOT NULL REFERENCES "scheduled_posts"("id") ON DELETE CASCADE,
  "user_id" UUID NOT NULL REFERENCES "users"("id"),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id"),
  "body" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ DEFAULT NOW()
);
--> statement-breakpoint

-- Affiliates
CREATE TABLE IF NOT EXISTS "affiliates" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID REFERENCES "users"("id"),
  "email" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "status" "affiliate_status" DEFAULT 'pending',
  "commission_rate" NUMERIC(5, 4) DEFAULT 0.20,
  "total_earned_cents" INTEGER DEFAULT 0,
  "total_paid_cents" INTEGER DEFAULT 0,
  "payout_threshold_cents" INTEGER DEFAULT 5000,
  "stripe_account_id" TEXT,
  "created_at" TIMESTAMPTZ DEFAULT NOW()
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "affiliate_links" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "affiliate_id" UUID NOT NULL REFERENCES "affiliates"("id"),
  "code" TEXT NOT NULL UNIQUE,
  "campaign" TEXT,
  "clicks" INTEGER DEFAULT 0,
  "conversions" INTEGER DEFAULT 0,
  "created_at" TIMESTAMPTZ DEFAULT NOW()
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "affiliate_conversions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "affiliate_link_id" UUID NOT NULL REFERENCES "affiliate_links"("id"),
  "converted_org_id" UUID REFERENCES "organizations"("id"),
  "plan_tier" TEXT NOT NULL,
  "commission_cents" INTEGER NOT NULL,
  "status" "conversion_status" DEFAULT 'pending',
  "cleared_at" TIMESTAMPTZ,
  "paid_at" TIMESTAMPTZ
);
--> statement-breakpoint

-- Promo codes
CREATE TABLE IF NOT EXISTS "promo_codes" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" TEXT NOT NULL UNIQUE,
  "discount_type" TEXT NOT NULL,
  "discount_value" INTEGER NOT NULL,
  "applicable_tiers" TEXT[],
  "max_uses" INTEGER,
  "used_count" INTEGER DEFAULT 0,
  "expires_at" TIMESTAMPTZ,
  "is_active" BOOLEAN DEFAULT TRUE,
  "stripe_coupon_id" TEXT,
  "paystack_plan_code" TEXT,
  "created_at" TIMESTAMPTZ DEFAULT NOW()
);
--> statement-breakpoint

-- Email campaigns
CREATE TABLE IF NOT EXISTS "email_campaigns" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id"),
  "brand_profile_id" UUID REFERENCES "brand_profiles"("id"),
  "subject" TEXT NOT NULL,
  "preview_text" TEXT,
  "html_body" TEXT NOT NULL,
  "plain_text" TEXT,
  "recipient_list" TEXT[] DEFAULT '{}',
  "status" "email_campaign_status" DEFAULT 'draft',
  "scheduled_at" TIMESTAMPTZ,
  "sent_at" TIMESTAMPTZ,
  "opens" INTEGER DEFAULT 0,
  "clicks" INTEGER DEFAULT 0,
  "created_at" TIMESTAMPTZ DEFAULT NOW()
);
--> statement-breakpoint

-- RSS feeds
CREATE TABLE IF NOT EXISTS "rss_feeds" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id"),
  "brand_profile_id" UUID REFERENCES "brand_profiles"("id"),
  "feed_url" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "last_fetched_at" TIMESTAMPTZ,
  "is_active" BOOLEAN DEFAULT TRUE,
  "created_at" TIMESTAMPTZ DEFAULT NOW()
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "feed_items" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "rss_feed_id" UUID NOT NULL REFERENCES "rss_feeds"("id") ON DELETE CASCADE,
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id"),
  "title" TEXT,
  "url" TEXT,
  "summary" TEXT,
  "published_at" TIMESTAMPTZ,
  "is_flagged" BOOLEAN DEFAULT FALSE,
  "created_at" TIMESTAMPTZ DEFAULT NOW()
);
