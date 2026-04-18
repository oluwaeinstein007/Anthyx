import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { authRouter } from "./routes/auth";
import { brandsRouter } from "./routes/brands";
import { agentsRouter } from "./routes/agents";
import { accountsRouter } from "./routes/accounts";
import { plansRouter } from "./routes/plans";
import { postsRouter } from "./routes/posts";
import { billingRouter } from "./routes/billing";
import { guardrailsRouter } from "./routes/guardrails";
import { analyticsRouter } from "./routes/analytics";
import { PlanLimitError } from "./services/billing/limits";
import { registerMcpRoutes } from "./mcp/server";

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

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (_, res) => res.json({ ok: true, ts: new Date().toISOString() }));

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
