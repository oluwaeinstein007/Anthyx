import { Router } from "express";
import { eq, and, count, desc } from "drizzle-orm";
import { db } from "../db/client";
import { forms, formResponses, brandProfiles } from "../db/schema";
import { auth } from "../middleware/auth";

const router = Router();

// GET /forms — list all forms for the org
router.get("/", auth, async (req, res) => {
  const list = await db.query.forms.findMany({
    where: eq(forms.organizationId, req.user.orgId),
    orderBy: [desc(forms.createdAt)],
  });

  // Attach response count to each form
  const withCounts = await Promise.all(
    list.map(async (form) => {
      const rows = await db
        .select({ value: count() })
        .from(formResponses)
        .where(eq(formResponses.formId, form.id));
      const lastResponse = await db.query.formResponses.findFirst({
        where: eq(formResponses.formId, form.id),
        orderBy: [desc(formResponses.submittedAt)],
      });
      return {
        ...form,
        responseCount: rows[0]?.value ?? 0,
        lastSubmittedAt: lastResponse?.submittedAt ?? null,
      };
    }),
  );

  return res.json(withCounts);
});

// POST /forms — create a new form
router.post("/", auth, async (req, res) => {
  const { title, description, fields, brandProfileId } = req.body as {
    title: string;
    description?: string;
    fields?: unknown[];
    brandProfileId?: string;
  };

  if (!title?.trim()) return res.status(400).json({ error: "title is required" });

  if (brandProfileId) {
    const brand = await db.query.brandProfiles.findFirst({
      where: and(eq(brandProfiles.id, brandProfileId), eq(brandProfiles.organizationId, req.user.orgId)),
    });
    if (!brand) return res.status(404).json({ error: "Brand not found" });
  }

  const [form] = await db
    .insert(forms)
    .values({
      organizationId: req.user.orgId,
      brandProfileId: brandProfileId ?? null,
      title: title.trim(),
      description: description ?? null,
      fields: (fields ?? []) as never,
    })
    .returning();

  return res.status(201).json(form);
});

// GET /forms/:id — get single form with response stats
router.get("/:id", auth, async (req, res) => {
  const form = await db.query.forms.findFirst({
    where: and(eq(forms.id, req.params.id!), eq(forms.organizationId, req.user.orgId)),
  });
  if (!form) return res.status(404).json({ error: "Form not found" });

  const rows = await db
    .select({ value: count() })
    .from(formResponses)
    .where(eq(formResponses.formId, form.id));

  return res.json({ ...form, responseCount: rows[0]?.value ?? 0 });
});

// GET /forms/:id/public — public endpoint for embed (no auth) — returns form schema only
router.get("/:id/public", async (req, res) => {
  const form = await db.query.forms.findFirst({
    where: and(eq(forms.id, req.params.id!), eq(forms.isActive, true)),
  });
  if (!form) return res.status(404).json({ error: "Form not found" });
  // Only expose non-sensitive fields
  return res.json({
    id: form.id,
    title: form.title,
    description: form.description,
    fields: form.fields,
  });
});

// PUT /forms/:id — update form
router.put("/:id", auth, async (req, res) => {
  const { title, description, fields, isActive, brandProfileId } = req.body as {
    title?: string;
    description?: string;
    fields?: unknown[];
    isActive?: boolean;
    brandProfileId?: string;
  };

  const [updated] = await db
    .update(forms)
    .set({
      ...(title !== undefined && { title: title.trim() }),
      ...(description !== undefined && { description }),
      ...(fields !== undefined && { fields: fields as never }),
      ...(isActive !== undefined && { isActive }),
      ...(brandProfileId !== undefined && { brandProfileId }),
      updatedAt: new Date(),
    })
    .where(and(eq(forms.id, req.params.id!), eq(forms.organizationId, req.user.orgId)))
    .returning();

  if (!updated) return res.status(404).json({ error: "Form not found" });
  return res.json(updated);
});

// DELETE /forms/:id
router.delete("/:id", auth, async (req, res) => {
  await db
    .delete(forms)
    .where(and(eq(forms.id, req.params.id!), eq(forms.organizationId, req.user.orgId)));
  return res.json({ ok: true });
});

// GET /forms/:id/responses — paginated responses
router.get("/:id/responses", auth, async (req, res) => {
  const form = await db.query.forms.findFirst({
    where: and(eq(forms.id, req.params.id!), eq(forms.organizationId, req.user.orgId)),
  });
  if (!form) return res.status(404).json({ error: "Form not found" });

  const limit = Math.min(parseInt(String(req.query["limit"] ?? "50")), 500);
  const offset = parseInt(String(req.query["offset"] ?? "0"));

  const responses = await db.query.formResponses.findMany({
    where: eq(formResponses.formId, form.id),
    orderBy: [desc(formResponses.submittedAt)],
    limit,
    offset,
  });

  return res.json({ responses, total: responses.length, limit, offset });
});

// POST /forms/:id/submit — public submission (no auth required)
router.post("/:id/submit", async (req, res) => {
  const form = await db.query.forms.findFirst({
    where: and(eq(forms.id, req.params.id!), eq(forms.isActive, true)),
  });
  if (!form) return res.status(404).json({ error: "Form not found or inactive" });

  const { data, respondentEmail } = req.body as {
    data: Record<string, unknown>;
    respondentEmail?: string;
  };

  if (!data || typeof data !== "object") {
    return res.status(400).json({ error: "data is required" });
  }

  const [response] = await db
    .insert(formResponses)
    .values({
      formId: form.id,
      organizationId: form.organizationId,
      respondentEmail: respondentEmail ?? null,
      data: data as never,
    })
    .returning();

  return res.status(201).json({ submitted: true, id: response!.id });
});

// GET /forms/:id/export — CSV download of all responses
router.get("/:id/export", auth, async (req, res) => {
  const form = await db.query.forms.findFirst({
    where: and(eq(forms.id, req.params.id!), eq(forms.organizationId, req.user.orgId)),
  });
  if (!form) return res.status(404).json({ error: "Form not found" });

  const responses = await db.query.formResponses.findMany({
    where: eq(formResponses.formId, form.id),
    orderBy: [desc(formResponses.submittedAt)],
    limit: 10000,
  });

  const fields = (form.fields as Array<{ id: string; label: string }>) ?? [];
  const escape = (s: unknown) => `"${String(s ?? "").replace(/"/g, '""').replace(/\n/g, " ")}"`;

  const headerCols = ["id", "submittedAt", "respondentEmail", ...fields.map((f) => escape(f.label))];
  const header = headerCols.join(",") + "\n";

  const rows = responses
    .map((r) => {
      const data = (r.data as Record<string, unknown>) ?? {};
      return [
        r.id,
        r.submittedAt?.toISOString() ?? "",
        escape(r.respondentEmail ?? ""),
        ...fields.map((f) => escape(data[f.id] ?? "")),
      ].join(",");
    })
    .join("\n");

  const filename = `${form.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-responses-${new Date().toISOString().slice(0, 10)}.csv`;

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  return res.send(header + rows);
});

// POST /forms/:id/ai-summary — AI analysis of form responses using Gemini → Claude
router.post("/:id/ai-summary", auth, async (req, res) => {
  try {
    const form = await db.query.forms.findFirst({
      where: and(eq(forms.id, req.params.id!), eq(forms.organizationId, req.user.orgId)),
    });
    if (!form) return res.status(404).json({ error: "Form not found" });

    const responses = await db.query.formResponses.findMany({
      where: eq(formResponses.formId, form.id),
      orderBy: [desc(formResponses.submittedAt)],
      limit: 200,
    });

    if (responses.length === 0) {
      return res.json({ summary: "No responses collected yet. Share your form to start gathering insights." });
    }

    const fields = (form.fields as Array<{ id: string; label: string; type: string }>) ?? [];

    // Build a compact text snapshot of the responses for the LLM
    const snapshot = fields
      .map((field) => {
        const answers = responses
          .map((r) => (r.data as Record<string, unknown>)[field.id])
          .filter((v) => v !== undefined && v !== null && v !== "");

        if (answers.length === 0) return null;

        if (field.type === "short_text" || field.type === "long_text") {
          const sample = answers.slice(0, 10).join(" | ");
          return `${field.label}: ${answers.length} responses, sample: "${sample}"`;
        }
        if (field.type === "rating" || field.type === "nps" || field.type === "scale") {
          const nums = answers.map(Number).filter((n) => !isNaN(n));
          const avg = nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : "N/A";
          return `${field.label}: avg ${avg} (${nums.length} responses)`;
        }
        if (field.type === "multiple_choice" || field.type === "single_choice") {
          const freq: Record<string, number> = {};
          for (const a of answers) {
            const key = String(a);
            freq[key] = (freq[key] ?? 0) + 1;
          }
          const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5)
            .map(([k, v]) => `"${k}" (${v})`).join(", ");
          return `${field.label}: ${top}`;
        }
        return `${field.label}: ${answers.length} responses`;
      })
      .filter(Boolean)
      .join("\n");

    const { generateWithFallback } = await import("../services/agent/llm-client");

    const summary = await generateWithFallback({
      systemPrompt: `You are a market research analyst. Summarise the following survey results in 3 clear sentences: what respondents think, the main insight, and one actionable recommendation for the brand. Be specific and data-driven. Do not use bullet points.`,
      userMessage: `Form title: "${form.title}"\nTotal responses: ${responses.length}\n\nResults:\n${snapshot}`,
      maxTokens: 300,
    });

    return res.json({ summary, responseCount: responses.length });
  } catch (err) {
    console.error("[forms/ai-summary]", err);
    return res.status(500).json({ error: "AI summary failed" });
  }
});

export { router as formsRouter };
