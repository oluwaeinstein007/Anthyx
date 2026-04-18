import { generateAIAsset } from "./ai-generator";
import { renderTemplateCard, pollBannerBearUntilReady } from "./template-renderer";

export interface AssetGenerationParams {
  contentText: string;
  suggestedMediaPrompt?: string | null;
  assetTrack?: "template" | "ai";
  brandPrimaryColors?: string[];
  brandSecondaryColors?: string[];
  bannerBearTemplateUid?: string | null;
  logoUrl?: string | null;
  platform?: string;
}

function extractHeadlineFromPost(contentText: string): string {
  // Use first 60 chars of the post as the headline
  const first = contentText.split("\n")[0] ?? contentText;
  return first.slice(0, 60);
}

export async function generateAssetForPost(
  params: AssetGenerationParams,
): Promise<string | null> {
  const hasVisualFlag =
    params.contentText.includes("[GENERATE_IMAGE]") || !!params.suggestedMediaPrompt;

  if (!hasVisualFlag) return null;

  const useTemplate =
    params.assetTrack === "template" && !!params.bannerBearTemplateUid;

  if (useTemplate) {
    const uid = await renderTemplateCard({
      templateUid: params.bannerBearTemplateUid!,
      primaryColor: params.brandPrimaryColors?.[0] ?? "#000000",
      secondaryColor:
        params.brandSecondaryColors?.[0] ?? params.brandPrimaryColors?.[0] ?? "#333333",
      headline: extractHeadlineFromPost(params.contentText),
      logoUrl: params.logoUrl ?? undefined,
      platform: (params.platform ?? "x") as "x" | "instagram" | "linkedin" | "facebook" | "telegram" | "tiktok",
    });
    return pollBannerBearUntilReady(uid);
  }

  // Fall back to DALL-E 3 (Track B)
  return generateAIAsset({
    prompt: params.suggestedMediaPrompt ?? "professional marketing visual for social media",
    brandColors: params.brandPrimaryColors ?? ["#0D9488"],
  });
}
