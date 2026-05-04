import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { brandProfiles } from "../db/schema";
import { auth } from "../middleware/auth";
import { generateWithFallback, CLAUDE_HAIKU } from "../services/agent/llm-client";

const router = Router();

// GET /seo/keywords?topic=X&brandProfileId=Y
router.get("/keywords", auth, async (req, res) => {
  const { topic, brandProfileId } = req.query as Record<string, string | undefined>;
  if (!topic?.trim()) return res.status(400).json({ error: "topic is required" });

  let industryContext = "";
  if (brandProfileId) {
    const brand = await db.query.brandProfiles.findFirst({
      where: eq(brandProfiles.id, brandProfileId),
      columns: { industry: true, name: true },
    });
    if (brand?.industry) industryContext = `Industry: ${brand.industry}. Brand: ${brand.name}.`;
  }

  const prompt = `${industryContext ? industryContext + "\n" : ""}Topic: "${topic}"

Suggest 8 SEO keywords for this topic. For each keyword, identify the search intent.
Return ONLY valid JSON array:
[
  { "keyword": "example keyword phrase", "intent": "informational|transactional|navigational", "notes": "brief note on why this keyword works" }
]`;

  try {
    const raw = await generateWithFallback({
      systemPrompt: "You are an expert SEO strategist. Return only valid JSON — no markdown, no preamble.",
      userMessage: prompt,
      claudeModel: CLAUDE_HAIKU,
      maxTokens: 1024,
    });

    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]") + 1;
    if (start === -1 || end === 0) return res.status(500).json({ error: "Failed to parse keyword response" });
    const keywords = JSON.parse(raw.slice(start, end));
    return res.json({ keywords, topic });
  } catch (err) {
    console.error("[seo/keywords]", err);
    return res.status(500).json({ error: "Keyword generation failed" });
  }
});

export { router as seoRouter };
