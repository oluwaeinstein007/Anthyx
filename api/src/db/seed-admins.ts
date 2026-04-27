/**
 * Seeds default admin accounts.
 * Run once on first deploy: npx tsx src/db/seed-admins.ts
 * All seeded accounts have mustChangePassword = true.
 */
import bcrypt from "bcryptjs";
import { db } from "./client";
import { users, organizations } from "./schema";
import { eq } from "drizzle-orm";

const ADMIN_PASSWORD = "12345678";

const ADMIN_ACCOUNTS = [
  { email: "superadmin@anthyx.com", name: "Super Admin", isSuperAdmin: true, role: "owner" },
  { email: "lanre@anthyx.com", name: "Lanre", isSuperAdmin: true, role: "admin" },
  { email: "support@anthyx.com", name: "Support", isSuperAdmin: false, role: "member" },
] as const;

async function seedAdmins() {
  console.log("Seeding admin accounts…");

  // Find or create the internal admin org
  let adminOrg = await db.query.organizations.findFirst({
    where: eq(organizations.slug, "anthyx-internal"),
  });

  if (!adminOrg) {
    const [created] = await db
      .insert(organizations)
      .values({ name: "Anthyx Internal", slug: "anthyx-internal" })
      .returning();
    adminOrg = created!;
    console.log("Created admin organization:", adminOrg.id);
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  for (const acct of ADMIN_ACCOUNTS) {
    const existing = await db.query.users.findFirst({
      where: eq(users.email, acct.email),
    });

    if (existing) {
      console.log(`  ↳ ${acct.email} already exists — skipping`);
      continue;
    }

    const [user] = await db
      .insert(users)
      .values({
        email: acct.email,
        name: acct.name,
        passwordHash,
        role: acct.role,
        isSuperAdmin: acct.isSuperAdmin,
        emailVerified: true,
        mustChangePassword: true,
        organizationId: adminOrg.id,
      })
      .returning();

    console.log(`  ✓ Created ${acct.email} (id: ${user!.id})`);
  }

  console.log("Admin seeding complete.");
  process.exit(0);
}

seedAdmins().catch((err) => {
  console.error("Admin seed failed:", err);
  process.exit(1);
});
