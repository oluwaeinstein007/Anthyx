export const productConfig = {
  name: "Anthyx",
  tagline: "Autonomous AI marketing at scale",
  description:
    "Multi-agent autonomous marketing platform. Ingest your brand, generate content, schedule and publish across every social platform — without lifting a finger.",

  domain: "anthyx.ai",
  apiUrl: "https://api.anthyx.ai",
  dashboardUrl: "https://app.anthyx.ai",
  marketingUrl: "https://anthyx.ai",

  contact: {
    supportEmail: "support@anthyx.ai",
    salesEmail: "sales@anthyx.ai",
    legalEmail: "legal@anthyx.ai",
    address: {
      line1: "",
      city: "",
      state: "",
      country: "",
      postalCode: "",
    },
  },

  social: {
    twitter: "https://twitter.com/anthyxai",
    linkedin: "https://linkedin.com/company/anthyx",
  },

  watermarkText: "Powered by Anthyx",
  watermarkUrl: "https://anthyx.ai",

  trialDays: 14,
  trialTier: "growth" as const,

  defaultOverageCapCents: 5_000,
  defaultBillingInterval: "monthly" as const,

  maxConcurrentPostJobs: 10,
  maxPostJobsPerMinute: 100,
  postJobRetryAttempts: 3,

  feedbackLoopMinPosts: 20,
  feedbackLoopLookbackDays: 30,

  maxReviewRetries: 2,
  underperformThreshold: 0.005,
  outperformMultiplier: 2.0,
} as const;

export type ProductConfig = typeof productConfig;
