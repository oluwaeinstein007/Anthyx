export type PlanTier = "sandbox" | "starter" | "growth" | "agency" | "scale" | "enterprise";
export type BillingInterval = "monthly" | "annual";
export type SubscriptionStatus = "active" | "past_due" | "cancelled" | "trialing" | "suspended";

export interface PlanTierConfig {
  tier: PlanTier;
  displayName: string;
  monthlyPrice: number; // cents
  annualPrice: number; // cents
  maxBrands: number; // -1 = unlimited
  maxAgents: number;
  maxSocialAccounts: number;
  maxPostsPerMonth: number;
  features: {
    autonomousScheduling: boolean;
    feedbackLoop: boolean;
    aiAssetGeneration: boolean;
    ipRotation: boolean;
    whiteLabel: boolean;
    assetWatermark: boolean;
    hitlRequired: boolean;
    guardrails: boolean;
    agentSilence: boolean;
    rbac: boolean;
  };
  overagePricePerPost: number; // cents, e.g. 4 = $0.04
  overagePricePerAccount: number; // cents
  overagePricePerBrand: number; // cents
}

export const PLAN_TIER_CONFIGS: Record<PlanTier, PlanTierConfig> = {
  sandbox: {
    tier: "sandbox",
    displayName: "Sandbox",
    monthlyPrice: 0,
    annualPrice: 0,
    maxBrands: 1,
    maxAgents: 1,
    maxSocialAccounts: 2,
    maxPostsPerMonth: 15,
    features: {
      autonomousScheduling: false,
      feedbackLoop: false,
      aiAssetGeneration: false,
      ipRotation: false,
      whiteLabel: false,
      assetWatermark: true,
      hitlRequired: true,
      guardrails: false,
      agentSilence: false,
      rbac: false,
    },
    overagePricePerPost: 0,
    overagePricePerAccount: 0,
    overagePricePerBrand: 0,
  },
  starter: {
    tier: "starter",
    displayName: "Starter",
    monthlyPrice: 4900,
    annualPrice: 3900,
    maxBrands: 1,
    maxAgents: 3,
    maxSocialAccounts: 5,
    maxPostsPerMonth: 120,
    features: {
      autonomousScheduling: true,
      feedbackLoop: false,
      aiAssetGeneration: false,
      ipRotation: false,
      whiteLabel: false,
      assetWatermark: false,
      hitlRequired: false,
      guardrails: true,
      agentSilence: true,
      rbac: false,
    },
    overagePricePerPost: 4,
    overagePricePerAccount: 800,
    overagePricePerBrand: 2500,
  },
  growth: {
    tier: "growth",
    displayName: "Growth",
    monthlyPrice: 14900,
    annualPrice: 11900,
    maxBrands: 3,
    maxAgents: 10,
    maxSocialAccounts: 15,
    maxPostsPerMonth: 500,
    features: {
      autonomousScheduling: true,
      feedbackLoop: true,
      aiAssetGeneration: true,
      ipRotation: false,
      whiteLabel: false,
      assetWatermark: false,
      hitlRequired: false,
      guardrails: true,
      agentSilence: true,
      rbac: false,
    },
    overagePricePerPost: 4,
    overagePricePerAccount: 800,
    overagePricePerBrand: 2500,
  },
  agency: {
    tier: "agency",
    displayName: "Agency",
    monthlyPrice: 39900,
    annualPrice: 31900,
    maxBrands: 15,
    maxAgents: -1,
    maxSocialAccounts: 50,
    maxPostsPerMonth: 2500,
    features: {
      autonomousScheduling: true,
      feedbackLoop: true,
      aiAssetGeneration: true,
      ipRotation: false,
      whiteLabel: true,
      assetWatermark: false,
      hitlRequired: false,
      guardrails: true,
      agentSilence: true,
      rbac: true,
    },
    overagePricePerPost: 4,
    overagePricePerAccount: 800,
    overagePricePerBrand: 2500,
  },
  scale: {
    tier: "scale",
    displayName: "Scale",
    monthlyPrice: 99900,
    annualPrice: 79900,
    maxBrands: -1,
    maxAgents: -1,
    maxSocialAccounts: 100,
    maxPostsPerMonth: 10000,
    features: {
      autonomousScheduling: true,
      feedbackLoop: true,
      aiAssetGeneration: true,
      ipRotation: true,
      whiteLabel: true,
      assetWatermark: false,
      hitlRequired: false,
      guardrails: true,
      agentSilence: true,
      rbac: true,
    },
    overagePricePerPost: 4,
    overagePricePerAccount: 800,
    overagePricePerBrand: 2500,
  },
  enterprise: {
    tier: "enterprise",
    displayName: "Enterprise",
    monthlyPrice: -1, // custom
    annualPrice: -1,
    maxBrands: -1,
    maxAgents: -1,
    maxSocialAccounts: -1,
    maxPostsPerMonth: -1,
    features: {
      autonomousScheduling: true,
      feedbackLoop: true,
      aiAssetGeneration: true,
      ipRotation: true,
      whiteLabel: true,
      assetWatermark: false,
      hitlRequired: false,
      guardrails: true,
      agentSilence: true,
      rbac: true,
    },
    overagePricePerPost: 0,
    overagePricePerAccount: 0,
    overagePricePerBrand: 0,
  },
};
