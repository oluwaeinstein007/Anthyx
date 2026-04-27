-- Extended brand profile attributes: identity, story, content strategy, audience, and archiving

ALTER TABLE brand_profiles
  -- Identity
  ADD COLUMN IF NOT EXISTS tagline                TEXT,
  ADD COLUMN IF NOT EXISTS brand_emojis           TEXT[] DEFAULT '{}',

  -- Brand Story & Values
  ADD COLUMN IF NOT EXISTS mission_statement      TEXT,
  ADD COLUMN IF NOT EXISTS vision_statement       TEXT,
  ADD COLUMN IF NOT EXISTS core_values            JSONB,  -- [{ label, description }]
  ADD COLUMN IF NOT EXISTS origin_story           TEXT,
  ADD COLUMN IF NOT EXISTS brand_stage            TEXT DEFAULT 'startup', -- idea | startup | growth | established | enterprise

  -- Content Strategy
  ADD COLUMN IF NOT EXISTS content_dos            TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS content_donts          TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS banned_words           TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cta_preferences        JSONB,  -- { platform: cta_text }
  ADD COLUMN IF NOT EXISTS hashtag_strategy       JSONB,  -- { always: [], rotate: [], avoid: [] }
  ADD COLUMN IF NOT EXISTS posting_languages      TEXT[] DEFAULT ARRAY['en'],
  ADD COLUMN IF NOT EXISTS content_ratio          JSONB,  -- { educational, promotional, entertaining, conversational }

  -- Audience & Market
  ADD COLUMN IF NOT EXISTS audience_personas      JSONB,  -- [{ name, ageRange, jobTitle, painPoints, goals, platforms }]
  ADD COLUMN IF NOT EXISTS geographic_focus       TEXT[] DEFAULT '{}',

  -- Social & Contact
  ADD COLUMN IF NOT EXISTS social_handles         JSONB,  -- { twitter, instagram, linkedin, tiktok, youtube, threads }
  ADD COLUMN IF NOT EXISTS website_url            TEXT,
  ADD COLUMN IF NOT EXISTS brand_email            TEXT,

  -- Voice examples (positive training samples)
  ADD COLUMN IF NOT EXISTS voice_examples         TEXT[] DEFAULT '{}',

  -- Archive
  ADD COLUMN IF NOT EXISTS archived_at            TIMESTAMPTZ,

  -- Ingestion history
  ADD COLUMN IF NOT EXISTS ingest_history         JSONB DEFAULT '[]';  -- [{ sourceType, sourceName, ingestedAt, summary }]
