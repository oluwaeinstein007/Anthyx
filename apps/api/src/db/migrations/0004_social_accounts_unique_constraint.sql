CREATE UNIQUE INDEX IF NOT EXISTS "social_accounts_org_platform_handle_idx" ON "social_accounts" ("organization_id","platform","account_handle");
