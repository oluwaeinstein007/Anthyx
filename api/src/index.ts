import * as Sentry from "@sentry/node";
Sentry.init({ dsn: process.env["SENTRY_DSN"] ?? "", enabled: !!process.env["SENTRY_DSN"] });
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
import { competitiveRouter } from "./routes/competitive";
import { mailingListsRouter } from "./routes/mailing-lists";
import { seoRouter } from "./routes/seo";
import { crmRouter } from "./routes/crm";
import { formsRouter } from "./routes/forms";
import { PlanLimitError } from "./services/billing/limits";
import { requireActiveSubscription } from "./middleware/subscription-guard";
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
const ALLOWED_ORIGINS = [
  process.env["DASHBOARD_URL"] ?? "http://localhost:3000",
  process.env["ADMIN_URL"] ?? "http://localhost:3001",
  process.env["AFFILIATE_URL"] ?? "http://localhost:3002",
];
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) callback(null, true);
      else callback(new Error("Not allowed by CORS"));
    },
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

// ── Subscription guard — block writes for suspended orgs ──────────────────────
// Passes GET/HEAD/OPTIONS through; blocks POST/PUT/PATCH/DELETE with 402.
const writeGuard: express.RequestHandler = (req, res, next) => {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    return next();
  }
  return requireActiveSubscription(req, res, next);
};

// ── API routes ────────────────────────────────────────────────────────────────
app.use("/v1/auth", authRouter);
app.use("/v1/brands", writeGuard, brandsRouter);
app.use("/v1/agents", writeGuard, agentsRouter);
app.use("/v1/accounts", writeGuard, accountsRouter);
app.use("/v1/plans", writeGuard, plansRouter);
app.use("/v1/posts", writeGuard, postsRouter);
app.use("/v1/billing", billingRouter);
app.use("/v1/guardrails", guardrailsRouter);
app.use("/v1/analytics", analyticsRouter);
app.use("/v1/repurpose", writeGuard, repurposeRouter);
app.use("/v1/campaigns", writeGuard, campaignsRouter);
app.use("/v1/team", writeGuard, teamRouter);
app.use("/v1/webhooks", writeGuard, webhooksRouter);
app.use("/v1/reports", reportsRouter);
app.use("/v1/admin", adminRouter);
app.use("/v1/inbox", writeGuard, inboxRouter);
app.use("/v1/email-campaigns", writeGuard, emailCampaignsRouter);
app.use("/v1/brands", writeGuard, feedsRouter);
app.use("/v1/affiliates", affiliatesRouter);
app.use("/v1/brands", writeGuard, competitiveRouter);
app.use("/v1/mailing-lists", writeGuard, mailingListsRouter);
app.use("/v1/seo", seoRouter);
app.use("/v1/crm", crmRouter);
app.use("/v1/forms", formsRouter);

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

    Sentry.captureException(err);
    console.error("[API] Unhandled error:", err);
    return res.status(500).json({ error: "Internal server error" });
  },
);

app.listen(PORT, () => {
  console.log(`[API] Server running on port ${PORT}`);
});

export default app;
