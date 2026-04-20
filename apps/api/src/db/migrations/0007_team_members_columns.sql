ALTER TABLE "plan_tiers" ADD COLUMN IF NOT EXISTS "max_team_members" integer DEFAULT 1;
ALTER TABLE "usage_records" ADD COLUMN IF NOT EXISTS "team_members_active" integer DEFAULT 0;
