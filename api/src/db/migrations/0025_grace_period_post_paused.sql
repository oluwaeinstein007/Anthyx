-- Add 'paused' status for posts (used when subscription enters grace period or is suspended)
ALTER TYPE post_status ADD VALUE IF NOT EXISTS 'paused';

-- Add grace period and voluntary-cancellation access window columns to subscriptions
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS grace_period_ends_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS access_until TIMESTAMP;
