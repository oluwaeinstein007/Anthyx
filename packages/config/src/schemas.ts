import { z } from "zod";

// ── Platform ───────────────────────────────────────────────────────────────────

export const PlatformSchema = z.enum([
  "x",
  "instagram",
  "linkedin",
  "facebook",
  "telegram",
  "tiktok",
  "discord",
  "whatsapp",
  "slack",
  "reddit",
  "threads",
  "bluesky",
  "mastodon",
  "youtube",
  "pinterest",
  "email",
]);

// ── Brand Ingestion ────────────────────────────────────────────────────────────

export const VoiceTraitsSchema = z.object({
  professional: z.boolean().optional(),
  witty: z.boolean().optional(),
  aggressive: z.boolean().optional(),
  empathetic: z.boolean().optional(),
  authoritative: z.boolean().optional(),
  casual: z.boolean().optional(),
});

export const BrandExtractionSchema = z.object({
  industry: z.string(),
  voiceTraits: VoiceTraitsSchema,
  toneDescriptors: z.array(z.string()),
  primaryColors: z.array(z.string().regex(/^#[0-9A-Fa-f]{6}$/)),
  secondaryColors: z.array(z.string().regex(/^#[0-9A-Fa-f]{6}$/)),
  typography: z.object({
    primary: z.string().nullable(),
    secondary: z.string().nullable(),
  }),
  brandStatements: z.array(z.string()),
  audienceNotes: z.array(z.string()),
  productsServices: z.array(z.string()).optional().default([]),
  valueProposition: z.string().nullable().optional().default(null),
  targetMarket: z.string().nullable().optional().default(null),
  contentPillars: z.array(z.string()).optional().default([]),
  competitors: z.array(z.string()).optional().default([]),
  // Identity fields auto-populated on ingest
  tagline: z.string().nullable().optional().default(null),
  websiteUrl: z.string().nullable().optional().default(null),
  brandEmail: z.string().nullable().optional().default(null),
  brandStage: z.enum(["idea", "startup", "growth", "established", "enterprise"]).nullable().optional().default(null),
  missionStatement: z.string().nullable().optional().default(null),
  visionStatement: z.string().nullable().optional().default(null),
  originStory: z.string().nullable().optional().default(null),
  coreValues: z.array(z.object({ label: z.string(), description: z.string().optional() })).optional().default([]),
  voiceExamples: z.array(z.string()).optional().default([]),
  contentDos: z.array(z.string()).optional().default([]),
  bannedWords: z.array(z.string()).optional().default([]),
});

export type BrandExtraction = z.infer<typeof BrandExtractionSchema>;

// ── Plan Items ─────────────────────────────────────────────────────────────────

const CONTENT_TYPE_COERCE: Record<string, string> = {
  collaboration: "engagement",
  branding: "promotional",
  awareness: "educational",
  informational: "educational",
  inspirational: "engagement",
  community: "engagement",
  product: "promotional",
  news: "trending",
  viral: "trending",
};

export const ContentTypeSchema = z.preprocess(
  (v) => {
    if (typeof v !== "string") return v;
    const lower = v.toLowerCase().trim();
    return CONTENT_TYPE_COERCE[lower] ?? lower;
  },
  z.enum([
    "educational",
    "promotional",
    "engagement",
    "trending",
    "user_generated",
  ]),
);

export const PlanItemSchema = z.object({
  date: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  platform: z.preprocess((s) => (typeof s === "string" ? s.toLowerCase() : s), PlatformSchema),
  contentType: ContentTypeSchema,
  topic: z.string().min(1).max(200),
  hook: z.string().min(1).max(500),
  cta: z.string().min(1).max(200),
  suggestVisual: z.preprocess((v) => {
    if (typeof v === "boolean") return v;
    if (typeof v === "string") {
      const lower = v.toLowerCase().trim();
      if (lower === "true" || lower === "yes" || lower === "1") return true;
      if (lower === "false" || lower === "no" || lower === "0") return false;
    }
    return v;
  }, z.boolean()),
  notes: z.string().optional(),
});

export const PlanItemArraySchema = z.array(PlanItemSchema);

export type PlanItem = z.infer<typeof PlanItemSchema>;

// ── Copywriter Output ──────────────────────────────────────────────────────────

export const CopywriterOutputSchema = z.object({
  content: z.string().min(1),
  hashtags: z.array(z.string()),
  suggestedMediaPrompt: z.string().nullable(),
  reasoning: z.string(),
});

// ── Reviewer Output ────────────────────────────────────────────────────────────

export const ReviewerOutputSchema = z.object({
  verdict: z.enum(["pass", "fail", "rewrite"]),
  issues: z.array(z.string()),
  revisedContent: z.string().nullable().optional(),
  revisedHashtags: z.array(z.string()).nullable().optional(),
});

// ── API Request Schemas ────────────────────────────────────────────────────────

export const CreateBrandSchema = z.object({
  name: z.string().min(1).max(100),
  industry: z.string().optional(),
});

export const CreateAgentSchema = z.object({
  brandProfileId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  dietInstructions: z.string().optional(),
  systemPromptOverride: z.string().optional(),
});

export const UpdateAgentSchema = CreateAgentSchema.partial().omit({ brandProfileId: true });

export const GeneratePlanSchema = z.object({
  brandProfileId: z.string().uuid(),
  agentId: z.string().uuid(),
  platforms: z.array(PlatformSchema).min(1),
  goals: z.array(z.string()).min(1),
  startDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  durationDays: z.number().int().min(7).max(90).optional().default(30),
  feedbackLoopEnabled: z.boolean().optional().default(false),
  postsPerPlatformPerDay: z.number().int().min(1).max(3).optional().default(1),
  targetLocale: z.string().optional(),
  campaignId: z.string().uuid().optional(),
});

export const ApprovePostSchema = z.object({
  reviewNotes: z.string().optional(),
});

export const VetoPostSchema = z.object({
  reason: z.string().min(1),
});

export const ReschedulePostSchema = z.object({
  scheduledAt: z.string().datetime({ offset: true }),
});

export const UpdatePostSchema = z.object({
  contentText: z.string().min(1).optional(),
  contentHashtags: z.array(z.string()).optional(),
  scheduledAt: z.string().datetime({ offset: true }).optional(),
});

export const BatchApproveSchema = z.object({
  postIds: z.array(z.string().uuid()).min(1).max(100),
  reviewNotes: z.string().optional(),
});

export const SilenceAgentSchema = z.object({
  reason: z.string().min(1),
});

export const UpdateGuardrailsSchema = z.object({
  globalProhibitions: z.array(z.string()),
});

export const AddBlackoutSchema = z.object({
  name: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const SubscribeSchema = z.object({
  tier: z.enum(["starter", "growth", "agency", "scale"]),
  interval: z.enum(["monthly", "annual"]),
  provider: z.enum(["stripe", "paystack"]).optional().default("paystack"),
  promoCode: z.string().optional(),
});

export const UpdateOverageCapSchema = z.object({
  overageCapCents: z.number().int().min(0).max(100_000_00),
});

export const ValidatePromoSchema = z.object({
  code: z.string().min(1),
  tier: z.enum(["starter", "growth", "agency", "scale"]).optional(),
});

export const CreateEmailCampaignSchema = z.object({
  brandProfileId: z.string().uuid(),
  subject: z.string().min(1).max(255),
  previewText: z.string().max(200).optional(),
  htmlBody: z.string().min(1),
  plainText: z.string().optional(),
  recipientList: z.array(z.string().email()).min(1),
  scheduledAt: z.string().datetime({ offset: true }).optional(),
});

export const CreateRssFeedSchema = z.object({
  feedUrl: z.string().url(),
  label: z.string().min(1).max(100),
});
