import { pgTable, uuid, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { scheduledPosts } from "./schema.js";

export const postAnalytics = pgTable("post_analytics", {
  id: uuid("id").primaryKey().defaultRandom(),
  postId: uuid("post_id").references(() => scheduledPosts.id).notNull(),
  fetchedAt: timestamp("fetched_at").defaultNow(),
  likes: integer("likes").default(0),
  reposts: integer("reposts").default(0),
  comments: integer("comments").default(0),
  impressions: integer("impressions").default(0),
  clicks: integer("clicks").default(0),
  engagementRate: text("engagement_rate"),
  rawData: jsonb("raw_data"),
});
