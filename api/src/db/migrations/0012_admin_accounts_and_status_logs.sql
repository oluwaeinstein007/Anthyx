-- Add must_change_password flag to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "must_change_password" BOOLEAN DEFAULT FALSE;
--> statement-breakpoint

-- Post status change audit trail
CREATE TABLE IF NOT EXISTS "post_status_logs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "post_id" UUID NOT NULL REFERENCES "scheduled_posts"("id") ON DELETE CASCADE,
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id"),
  "actor_id" UUID REFERENCES "users"("id"),
  "from_status" TEXT NOT NULL,
  "to_status" TEXT NOT NULL,
  "reason" TEXT,
  "created_at" TIMESTAMPTZ DEFAULT NOW()
);
