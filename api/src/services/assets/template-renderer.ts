import type { Platform } from "@anthyx/types";

const BANNERBEAR_API = "https://api.bannerbear.com/v2";

interface TemplateRenderParams {
  templateUid: string;
  primaryColor: string;
  secondaryColor: string;
  headline: string;
  subtext?: string;
  logoUrl?: string;
  platform: Platform;
}

export async function renderTemplateCard(params: TemplateRenderParams): Promise<string> {
  const modifications = [
    { name: "background", color: params.primaryColor.replace("#", "") },
    { name: "accent", color: params.secondaryColor.replace("#", "") },
    { name: "headline_text", text: params.headline.slice(0, 60) },
    { name: "sub_text", text: params.subtext ?? "" },
    { name: "logo", image_url: params.logoUrl ?? "" },
  ];

  const response = await fetch(`${BANNERBEAR_API}/images`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env["BANNERBEAR_API_KEY"]}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      template: params.templateUid,
      modifications,
      webhook_url: `${process.env["API_URL"]}/v1/webhooks/bannerbear`,
    }),
  });

  if (!response.ok) {
    throw new Error(`BannerBear render failed: ${response.status}`);
  }

  const data = (await response.json()) as { uid: string };
  return data.uid;
}

export async function pollBannerBearUntilReady(uid: string, maxAttempts = 20): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, 3000)); // wait 3s

    const response = await fetch(`${BANNERBEAR_API}/images/${uid}`, {
      headers: { Authorization: `Bearer ${process.env["BANNERBEAR_API_KEY"]}` },
    });

    const data = (await response.json()) as { status: string; image_url_png?: string };

    if (data.status === "completed" && data.image_url_png) {
      return data.image_url_png;
    }

    if (data.status === "failed") {
      throw new Error(`BannerBear render failed for uid: ${uid}`);
    }
  }

  throw new Error(`BannerBear render timed out for uid: ${uid}`);
}

/**
 * Alternative: Cloudinary dynamic image URL (no async round-trip needed)
 */
export function buildCloudinaryCardUrl(params: {
  publicId: string;
  overlayText: string;
  primaryColor: string;
}): string {
  const color = params.primaryColor.replace("#", "");
  const text = encodeURIComponent(params.overlayText.slice(0, 80));
  const cloudName = process.env["CLOUDINARY_CLOUD_NAME"];
  return (
    `https://res.cloudinary.com/${cloudName}/image/upload/` +
    `e_colorize,co_rgb:${color}/` +
    `l_text:Arial_40_bold:${text},co_white,g_south,y_40/` +
    `${params.publicId}.png`
  );
}
