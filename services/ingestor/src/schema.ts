import { pgTable, uuid, text, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
});

export const brandProfiles = pgTable("brand_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  name: text("name").notNull(),
  industry: text("industry"),
  tagline: text("tagline"),
  websiteUrl: text("website_url"),
  brandEmail: text("brand_email"),
  brandStage: text("brand_stage"),
  missionStatement: text("mission_statement"),
  visionStatement: text("vision_statement"),
  originStory: text("origin_story"),
  voiceTraits: jsonb("voice_traits"),
  toneDescriptors: text("tone_descriptors").array(),
  voiceExamples: text("voice_examples").array(),
  primaryColors: text("primary_colors").array(),
  secondaryColors: text("secondary_colors").array(),
  typography: jsonb("typography"),
  coreValues: jsonb("core_values"),
  contentDos: text("content_dos").array(),
  bannedWords: text("banned_words").array(),
  brandContext: jsonb("brand_context"),
  qdrantCollectionId: text("qdrant_collection_id").unique(),
  sourceFiles: jsonb("source_files"),
  ingestStatus: text("ingest_status"),
  ingestHistory: jsonb("ingest_history"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const competitorTierEnum = pgEnum("competitor_tier", ["direct", "indirect", "aspirational"]);
export const competitorStatusEnum = pgEnum("competitor_status", ["active", "inactive", "new"]);

export const competitors = pgTable("competitors", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  brandProfileId: uuid("brand_profile_id").references(() => brandProfiles.id).notNull(),
  name: text("name").notNull(),
  websiteUrl: text("website_url"),
  socialHandles: jsonb("social_handles"),
  tier: competitorTierEnum("tier").default("direct"),
  status: competitorStatusEnum("status").default("active"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
