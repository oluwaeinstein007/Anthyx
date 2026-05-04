-- 2FA columns on users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totp_secret" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totp_enabled" boolean DEFAULT false;

-- Post versions table (captures content before each edit in HITL)
CREATE TABLE IF NOT EXISTS "post_versions" (
  "id"               uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  "post_id"          uuid      NOT NULL REFERENCES "scheduled_posts"("id") ON DELETE CASCADE,
  "organization_id"  uuid      NOT NULL REFERENCES "organizations"("id"),
  "edited_by"        uuid      REFERENCES "users"("id"),
  "content_text"     text      NOT NULL,
  "content_hashtags" text[],
  "scheduled_at"     timestamptz,
  "version_number"   integer   NOT NULL DEFAULT 1,
  "created_at"       timestamptz DEFAULT now()
);

-- UTM tracking on scheduled_posts
ALTER TABLE "scheduled_posts" ADD COLUMN IF NOT EXISTS "utm_source"   text;
ALTER TABLE "scheduled_posts" ADD COLUMN IF NOT EXISTS "utm_medium"   text;
ALTER TABLE "scheduled_posts" ADD COLUMN IF NOT EXISTS "utm_campaign" text;
ALTER TABLE "scheduled_posts" ADD COLUMN IF NOT EXISTS "utm_content"  text;

-- Conversion events table (CRM tracking)
CREATE TABLE IF NOT EXISTS "conversion_events" (
  "id"              uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid      NOT NULL REFERENCES "organizations"("id"),
  "utm_source"      text,
  "utm_medium"      text,
  "utm_campaign"    text,
  "utm_content"     text,
  "event_type"      text      NOT NULL,
  "amount_cents"    integer,
  "metadata"        jsonb,
  "source"          text      DEFAULT 'webhook',
  "received_at"     timestamptz DEFAULT now()
);
