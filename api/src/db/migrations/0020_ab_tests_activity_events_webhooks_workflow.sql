DO $$ BEGIN
  CREATE TYPE "ab_test_status" AS ENUM('running', 'completed', 'winner_promoted');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "actor_type" AS ENUM('agent', 'human');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "entity_type" AS ENUM('post', 'plan', 'brand', 'agent');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "workflow_stage" AS ENUM('plan_review', 'hitl', 'legal_review', 'analytics_only');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ab_tests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "post_a_id" uuid NOT NULL REFERENCES "scheduled_posts"("id"),
  "post_b_id" uuid NOT NULL REFERENCES "scheduled_posts"("id"),
  "winner_id" uuid REFERENCES "scheduled_posts"("id"),
  "status" "ab_test_status" DEFAULT 'running',
  "promoted_at" timestamp,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "activity_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "actor_type" "actor_type" NOT NULL,
  "actor_id" uuid NOT NULL,
  "entity_type" "entity_type" NOT NULL,
  "entity_id" uuid NOT NULL,
  "event" text NOT NULL,
  "diff" jsonb,
  "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webhook_endpoints" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "url" text NOT NULL,
  "events" text[] DEFAULT '{}',
  "channels" text[] DEFAULT '{}',
  "secret" text,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workflow_participants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "brand_profile_id" uuid REFERENCES "brand_profiles"("id"),
  "agent_id" uuid REFERENCES "agents"("id"),
  "stage" "workflow_stage" NOT NULL,
  "can_edit" boolean DEFAULT false,
  "can_veto" boolean DEFAULT false,
  "notify_on" text[] DEFAULT '{}',
  "created_at" timestamp DEFAULT now()
);
