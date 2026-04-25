import "express-async-errors";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { authRouter } from "./routes/auth";
import { brandsRouter } from "./routes/brands";
import { agentsRouter } from "./routes/agents";
import { accountsRouter } from "./routes/accounts";
import { plansRouter } from "./routes/plans";
import { postsRouter } from "./routes/posts";
import { billingRouter } from "./routes/billing";
import { guardrailsRouter } from "./routes/guardrails";
import { analyticsRouter } from "./routes/analytics";
import { repurposeRouter } from "./routes/repurpose";
import { campaignsRouter } from "./routes/campaigns";
import { teamRouter } from "./routes/team";
import { webhooksRouter } from "./routes/webhooks";
import { reportsRouter } from "./routes/reports";
import { adminRouter } from "./routes/admin";
import { inboxRouter } from "./routes/inbox";
import { emailCampaignsRouter } from "./routes/email-campaigns";
import { feedsRouter } from "./routes/feeds";
import { affiliatesRouter } from "./routes/affiliates";
import { PlanLimitError } from "./services/billing/limits";
import { registerMcpRoutes } from "./mcp/server";
import { db } from "./db/client";
import { sql } from "drizzle-orm";
import { redisConnection } from "./queue/client";

const app = express();
const PORT = parseInt(process.env["PORT"] ?? "4000");

// ── Stripe webhook needs raw body — mount before JSON parser ──────────────────
app.use(
  "/v1/billing/webhook",
  express.raw({ type: "application/json" }),
);

// ── Standard middleware ───────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env["DASHBOARD_URL"] ?? "http://localhost:3000",
    credentials: true,
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

// ── Rate limiting — 100 req/min per IP ───────────────────────────────────────
app.use(
  "/v1",
  rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests — slow down" },
  }),
);

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", async (_, res) => {
  let dbOk = false;
  let redisOk = false;

  try {
    await db.execute(sql`SELECT 1`);
    dbOk = true;
  } catch {}

  try {
    await redisConnection.ping();
    redisOk = true;
  } catch {}

  const status = dbOk && redisOk ? "ok" : "degraded";
  return res.status(status === "ok" ? 200 : 503).json({ status, db: dbOk, redis: redisOk, ts: new Date().toISOString() });
});

// ── API routes ────────────────────────────────────────────────────────────────
app.use("/v1/auth", authRouter);
app.use("/v1/brands", brandsRouter);
app.use("/v1/agents", agentsRouter);
app.use("/v1/accounts", accountsRouter);
app.use("/v1/plans", plansRouter);
app.use("/v1/posts", postsRouter);
app.use("/v1/billing", billingRouter);
app.use("/v1/guardrails", guardrailsRouter);
app.use("/v1/analytics", analyticsRouter);
app.use("/v1/repurpose", repurposeRouter);
app.use("/v1/campaigns", campaignsRouter);
app.use("/v1/team", teamRouter);
app.use("/v1/webhooks", webhooksRouter);
app.use("/v1/reports", reportsRouter);
app.use("/v1/admin", adminRouter);
app.use("/v1/inbox", inboxRouter);
app.use("/v1/email-campaigns", emailCampaignsRouter);
app.use("/v1/brands", feedsRouter);
app.use("/v1/affiliates", affiliatesRouter);

// ── MCP SSE routes ────────────────────────────────────────────────────────────
registerMcpRoutes(app);

// ── Global error handler ──────────────────────────────────────────────────────
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    if (err instanceof PlanLimitError) {
      return res.status(402).json({
        error: "Plan limit reached",
        limitType: err.limitType,
        message: err.message,
      });
    }

    console.error("[API] Unhandled error:", err);
    return res.status(500).json({ error: "Internal server error" });
  },
);

app.listen(PORT, () => {
  console.log(`[API] Server running on port ${PORT}`);
});

export default app;
