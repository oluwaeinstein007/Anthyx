-- Seed internal Anthyx admin organization and admin user accounts.
-- All accounts are seeded with password "12345678" and must_change_password = true.

INSERT INTO organizations (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'Anthyx Internal', 'anthyx-internal')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO users (id, organization_id, email, name, password_hash, role, is_super_admin, email_verified, must_change_password)
VALUES
  (
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000001',
    'superadmin@anthyx.com',
    'Super Admin',
    '$2a$10$qrHAxpjpMclwTVIMiguZDufoBXbifOVEQCxShO2i27JTrjvMEHToq',
    'owner',
    true,
    true,
    true
  ),
  (
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000001',
    'lanre@anthyx.com',
    'Lanre',
    '$2a$10$qrHAxpjpMclwTVIMiguZDufoBXbifOVEQCxShO2i27JTrjvMEHToq',
    'admin',
    true,
    true,
    true
  ),
  (
    '00000000-0000-0000-0000-000000000012',
    '00000000-0000-0000-0000-000000000001',
    'support@anthyx.com',
    'Support',
    '$2a$10$qrHAxpjpMclwTVIMiguZDufoBXbifOVEQCxShO2i27JTrjvMEHToq',
    'member',
    false,
    true,
    true
  )
ON CONFLICT (email) DO NOTHING;
