-- Forms: in-app form builder for market research, branding, and marketing surveys
CREATE TABLE IF NOT EXISTS "forms" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "brand_profile_id" uuid REFERENCES "brand_profiles"("id"),
  "title" text NOT NULL,
  "description" text,
  "fields" jsonb NOT NULL DEFAULT '[]',
  "is_active" boolean DEFAULT true,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Form responses: stores every submission
CREATE TABLE IF NOT EXISTS "form_responses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "form_id" uuid NOT NULL REFERENCES "forms"("id") ON DELETE CASCADE,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "respondent_email" text,
  "data" jsonb NOT NULL DEFAULT '{}',
  "submitted_at" timestamp DEFAULT now()
);
