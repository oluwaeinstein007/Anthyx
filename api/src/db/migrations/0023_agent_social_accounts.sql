-- Fix agents FK: cascade delete agents when their brand is deleted
ALTER TABLE "agents" DROP CONSTRAINT IF EXISTS "agents_brand_profile_id_brand_profiles_id_fk";
ALTER TABLE "agents" ADD CONSTRAINT "agents_brand_profile_id_brand_profiles_id_fk"
  FOREIGN KEY ("brand_profile_id") REFERENCES "brand_profiles"("id") ON DELETE CASCADE;

-- Add brand_profile_id to social_accounts (nullable — set during assign step, nulled when brand is deleted)
ALTER TABLE "social_accounts" ADD COLUMN "brand_profile_id" uuid
  REFERENCES "brand_profiles"("id") ON DELETE SET NULL;

-- Create agent_social_accounts join table (many-to-many: agent ↔ social account)
CREATE TABLE "agent_social_accounts" (
  "agent_id"         uuid      NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "social_account_id" uuid     NOT NULL REFERENCES "social_accounts"("id") ON DELETE CASCADE,
  "is_default"       boolean   DEFAULT true,
  "created_at"       timestamp DEFAULT now(),
  PRIMARY KEY ("agent_id", "social_account_id")
);

-- Backfill: set brand_profile_id on accounts that already had an agent assigned
UPDATE "social_accounts" sa
SET "brand_profile_id" = a."brand_profile_id"
FROM "agents" a
WHERE sa."agent_id" = a."id";

-- Backfill: migrate existing single-agent assignments into the join table
INSERT INTO "agent_social_accounts" ("agent_id", "social_account_id", "is_default")
SELECT "agent_id", "id", true
FROM "social_accounts"
WHERE "agent_id" IS NOT NULL;

-- Drop the old 1-to-1 agent_id column
ALTER TABLE "social_accounts" DROP COLUMN "agent_id";
