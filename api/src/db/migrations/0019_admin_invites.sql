-- Admin invite system: allows super admins to invite new admin-panel users via a signed token link

CREATE TABLE IF NOT EXISTS admin_invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'support',  -- 'owner' | 'admin' | 'support' | 'billing'
  token       TEXT NOT NULL UNIQUE,             -- secure random token (URL-safe, 48 chars)
  invited_by  UUID REFERENCES users(id),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_invites_token_idx ON admin_invites (token);
CREATE INDEX IF NOT EXISTS admin_invites_email_idx ON admin_invites (email);
