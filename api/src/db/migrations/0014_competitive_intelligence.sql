CREATE TYPE "competitor_tier" AS ENUM ('direct', 'indirect', 'aspirational');
CREATE TYPE "competitor_status" AS ENUM ('active', 'inactive', 'new');

CREATE TABLE IF NOT EXISTS "competitors" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id"),
  "brand_profile_id" UUID NOT NULL REFERENCES "brand_profiles"("id"),
  "name" TEXT NOT NULL,
  "website_url" TEXT,
  "social_handles" JSONB,
  "tier" "competitor_tier" DEFAULT 'direct',
  "status" "competitor_status" DEFAULT 'active',
  "notes" TEXT,
  "created_at" TIMESTAMPTZ DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "competitor_analyses" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "brand_profile_id" UUID NOT NULL REFERENCES "brand_profiles"("id"),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id"),
  "industry_overview" JSONB,
  "content_analysis" JSONB,
  "engagement_benchmarks" JSONB,
  "gap_analysis" JSONB,
  "share_of_voice" JSONB,
  "sentiment_analysis" JSONB,
  "benchmark_scorecard" JSONB,
  "generated_at" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "competitors_brand_idx" ON "competitors"("brand_profile_id");
CREATE INDEX IF NOT EXISTS "competitor_analyses_brand_idx" ON "competitor_analyses"("brand_profile_id");
