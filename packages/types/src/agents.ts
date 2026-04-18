import type { Platform } from "./platforms";

export type AgentModel = "claude-opus-4-5" | "claude-sonnet-4-6" | "claude-haiku-4-5-20251001";

export interface Agent {
  id: string;
  organizationId: string;
  brandProfileId: string;
  name: string;
  description?: string | null;
  dietInstructions?: string | null;
  systemPromptOverride?: string | null;
  isActive: boolean;
  silencedAt?: Date | null;
  silenceReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BrandProfile {
  id: string;
  organizationId: string;
  name: string;
  industry?: string | null;
  voiceTraits?: VoiceTraits | null;
  toneDescriptors?: string[] | null;
  primaryColors?: string[] | null;
  secondaryColors?: string[] | null;
  typography?: Typography | null;
  qdrantCollectionId?: string | null;
  sourceFiles?: SourceFile[] | null;
  bannerBearTemplateUid?: string | null;
  logoUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface VoiceTraits {
  professional?: boolean;
  witty?: boolean;
  aggressive?: boolean;
  empathetic?: boolean;
  authoritative?: boolean;
  casual?: boolean;
  [key: string]: boolean | undefined;
}

export interface Typography {
  primary?: string | null;
  secondary?: string | null;
}

export interface SourceFile {
  type: "pdf" | "markdown" | "url";
  name: string;
  url?: string;
}

// ── Strategist Types ──────────────────────────────────────────────────────────

export interface StrategistInput {
  brandId: string;
  brandName: string;
  industry: string;
  goals: string[];
  platforms: Platform[];
  startDate: string;
  feedbackLoopEnabled?: boolean;
}

export interface GeneratedPlanItem {
  date: string; // ISO8601
  platform: Platform;
  contentType: "educational" | "promotional" | "engagement" | "trending" | "user_generated";
  topic: string;
  hook: string;
  cta: string;
  suggestVisual: boolean;
  notes?: string;
}

// ── Copywriter Types ──────────────────────────────────────────────────────────

export interface CopywriterContext {
  personaName: string;
  brandName: string;
  brandVoiceRules: string;
  dietInstructions: string;
  platform: Platform;
  topic: string;
  contentType: GeneratedPlanItem["contentType"];
  hook: string;
  cta: string;
  scheduledAt: string;
}

export interface CopywriterOutput {
  content: string;
  hashtags: string[];
  suggestedMediaPrompt: string | null;
  reasoning: string;
}

// ── Reviewer Types ────────────────────────────────────────────────────────────

export interface ReviewerInput {
  postContent: string;
  hashtags: string[];
  platform: Platform;
  brandRules: string;
  dietInstructions: string;
  platformConstraints: string;
}

export interface ReviewerOutput {
  verdict: "pass" | "fail" | "rewrite";
  issues: string[];
  revisedContent?: string | null;
  revisedHashtags?: string[] | null;
}

// ── Brand Chunk (Qdrant) ──────────────────────────────────────────────────────

export interface BrandChunk {
  id: string;
  type: "voice_rule" | "tone_descriptor" | "color_reference" | "brand_statement" | "audience_note";
  text: string;
  source: string;
  organizationId: string;
  brandProfileId: string;
}

// ── MCP Tool Input/Output Types ───────────────────────────────────────────────

export interface RetrieveBrandContextInput {
  brandProfileId: string;
  query: string;
  topK?: number;
}

export interface RetrieveBrandContextOutput {
  chunks: BrandChunk[];
  voiceTraits: VoiceTraits;
  colors: string[];
}

export interface WebSearchTrendsInput {
  industry: string;
  keywords: string[];
  timeframe: "7d" | "30d";
}

export interface Trend {
  title: string;
  summary: string;
  url?: string;
  relevanceScore?: number;
}

export interface WebSearchTrendsOutput {
  trends: Trend[];
  relevantTopics: string[];
}
