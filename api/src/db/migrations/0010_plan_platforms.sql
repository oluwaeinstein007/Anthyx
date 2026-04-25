ALTER TABLE "marketing_plans" ADD COLUMN IF NOT EXISTS "platforms" text[];
--> statement-breakpoint
ALTER TABLE "marketing_plans" ADD COLUMN IF NOT EXISTS "fail_reason" text;
