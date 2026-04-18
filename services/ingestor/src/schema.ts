import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
});

export const brandProfiles = pgTable("brand_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  name: text("name").notNull(),
  industry: text("industry"),
  voiceTraits: jsonb("voice_traits"),
  toneDescriptors: text("tone_descriptors").array(),
  primaryColors: text("primary_colors").array(),
  secondaryColors: text("secondary_colors").array(),
  typography: jsonb("typography"),
  qdrantCollectionId: text("qdrant_collection_id").unique(),
  sourceFiles: jsonb("source_files"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
