CREATE TABLE IF NOT EXISTS "email_templates" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "html_body" TEXT NOT NULL,
  "plain_text" TEXT,
  "variables" TEXT[] DEFAULT '{}',
  "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default templates
INSERT INTO "email_templates" ("id", "name", "subject", "html_body", "plain_text", "variables") VALUES
(
  'verify-email',
  'Email Verification',
  'Verify your email — Anthyx',
  '<p>Hi {{name}},</p><p>Welcome to Anthyx! Please verify your email address:</p><p><a href="{{verifyUrl}}">{{verifyUrl}}</a></p><p>This link expires in {{expiresIn}}.</p><p>If you didn''t create an account, you can safely ignore this email.</p><p>The Anthyx team</p>',
  E'Hi {{name}},\n\nWelcome to Anthyx! Please verify your email address:\n\n{{verifyUrl}}\n\nThis link expires in {{expiresIn}}.\n\nIf you didn''t create an account, you can safely ignore this email.\n\nThe Anthyx team',
  ARRAY['{{name}}', '{{verifyUrl}}', '{{expiresIn}}']
),
(
  'password-reset',
  'Password Reset',
  'Reset your Anthyx password',
  '<p>Hi {{name}},</p><p>You requested a password reset. Click the link below:</p><p><a href="{{resetUrl}}">{{resetUrl}}</a></p><p>This link expires in {{expiresIn}}. If you didn''t request this, no action is needed.</p><p>The Anthyx team</p>',
  E'Hi {{name}},\n\nYou requested a password reset. Click the link below:\n\n{{resetUrl}}\n\nThis link expires in {{expiresIn}}. If you didn''t request this, no action is needed.\n\nThe Anthyx team',
  ARRAY['{{name}}', '{{resetUrl}}', '{{expiresIn}}']
),
(
  'trial-ending',
  'Trial Ending Soon',
  'Your Anthyx trial ends in 3 days',
  '<p>Hi {{name}},</p><p>Your Anthyx trial ends on {{trialEndDate}}.</p><p>Upgrade now to keep your agents running and never miss a post:</p><p><a href="{{upgradeUrl}}">{{upgradeUrl}}</a></p><p>The Anthyx team</p>',
  E'Hi {{name}},\n\nYour Anthyx trial ends on {{trialEndDate}}.\n\nUpgrade now to keep your agents running and never miss a post:\n\n{{upgradeUrl}}\n\nThe Anthyx team',
  ARRAY['{{name}}', '{{trialEndDate}}', '{{upgradeUrl}}']
),
(
  'payment-failed',
  'Payment Failed',
  'Action required: payment failed for your Anthyx subscription',
  '<p>Hi {{name}},</p><p>We couldn''t process your payment of {{amount}}.</p><p>Please update your payment method:</p><p><a href="{{updatePaymentUrl}}">{{updatePaymentUrl}}</a></p><p>We''ll retry on {{retryDate}}. If payment fails again, your account will be downgraded.</p><p>The Anthyx team</p>',
  E'Hi {{name}},\n\nWe couldn''t process your payment of {{amount}}.\n\nPlease update your payment method:\n{{updatePaymentUrl}}\n\nWe''ll retry on {{retryDate}}. If payment fails again, your account will be downgraded.\n\nThe Anthyx team',
  ARRAY['{{name}}', '{{amount}}', '{{retryDate}}', '{{updatePaymentUrl}}']
),
(
  'post-failed',
  'Post Failed Alert',
  'Post failed to publish — action needed',
  '<p>Hi {{name}},</p><p>A scheduled post for {{platform}} failed to publish.</p><p>Post ID: {{postId}}<br>Error: {{error}}</p><p>Review the post: <a href="{{reviewUrl}}">{{reviewUrl}}</a></p><p>The Anthyx team</p>',
  E'Hi {{name}},\n\nA scheduled post for {{platform}} failed to publish.\n\nPost ID: {{postId}}\nError: {{error}}\n\nReview the post:\n{{reviewUrl}}\n\nThe Anthyx team',
  ARRAY['{{name}}', '{{platform}}', '{{postId}}', '{{error}}', '{{reviewUrl}}']
)
ON CONFLICT ("id") DO NOTHING;
