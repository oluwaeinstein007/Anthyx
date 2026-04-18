import { z } from "zod";

// ── Platform ───────────────────────────────────────────────────────────────────

export const PlatformSchema = z.enum([
  "x",
  "instagram",
  "linkedin",
  "facebook",
  "telegram",
  "tiktok",
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
  brandStatements: z.array(z.string()).max(5),
  audienceNotes: z.array(z.string()).max(3),
});

export type BrandExtraction = z.infer<typeof BrandExtractionSchema>;

// ── Plan Items ─────────────────────────────────────────────────────────────────

export const ContentTypeSchema = z.enum([
  "educational",
  "promotional",
  "engagement",
  "trending",
  "user_generated",
]);

export const PlanItemSchema = z.object({
  date: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  platform: PlatformSchema,
  contentType: ContentTypeSchema,
  topic: z.string().min(1).max(200),
  hook: z.string().min(1).max(500),
  cta: z.string().min(1).max(200),
  suggestVisual: z.boolean(),
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
  provider: z.enum(["stripe", "paystack"]).optional().default("stripe"),
});

export const UpdateOverageCapSchema = z.object({
  overageCapCents: z.number().int().min(0).max(100_000_00),
});
