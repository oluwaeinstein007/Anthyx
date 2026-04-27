-- Mailing lists and subscribers

CREATE TYPE subscriber_status AS ENUM ('active', 'unsubscribed');

CREATE TABLE mailing_lists (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name          TEXT NOT NULL,
  description   TEXT,
  tags          TEXT[] NOT NULL DEFAULT '{}',
  archived_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE mailing_list_subscribers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mailing_list_id UUID NOT NULL REFERENCES mailing_lists(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  email           TEXT NOT NULL,
  first_name      TEXT,
  last_name       TEXT,
  tags            TEXT[] NOT NULL DEFAULT '{}',
  status          subscriber_status NOT NULL DEFAULT 'active',
  added_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX mailing_list_subscribers_unique ON mailing_list_subscribers (mailing_list_id, email);
CREATE INDEX mailing_list_subscribers_org ON mailing_list_subscribers (organization_id);
CREATE INDEX mailing_lists_org ON mailing_lists (organization_id);
