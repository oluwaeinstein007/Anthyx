/**
 * Worker process entry point.
 * Starts all BullMQ workers — runs separately from the API server.
 */
import { postWorker } from "./post.worker";
import { contentWorker } from "./content.worker";
import { planWorker } from "./plan.worker";
import { analyticsWorker } from "./analytics.worker";
import { ingestorWorker } from "./ingestor.worker";
import { notificationWorker } from "./notification.worker";
import { feedsWorker } from "./feeds.worker";
import "./overage.worker";
import cron from "node-cron";
import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "../db/client";
import { subscriptions, users, organizations } from "../db/schema";

console.log("[Workers] Starting all BullMQ workers...");
console.log("[Workers] Post execution worker: active");
console.log("[Workers] Content generation worker: active");
console.log("[Workers] Plan generation worker: active");
console.log("[Workers] Analytics worker: active");
console.log("[Workers] Overage cron worker: active");
console.log("[Workers] Ingestor worker: active");
console.log("[Workers] Notification worker: active");
console.log("[Workers] Feeds ingestor worker: active");

// Daily 9am: email orgs whose trial ends in 3 days
cron.schedule("0 9 * * *", async () => {
  try {
    const now = new Date();
    const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const in4Days = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);

    const trialingSubs = await db.query.subscriptions.findMany({
      where: and(
        gte(subscriptions.trialEndsAt, in3Days),
        lte(subscriptions.trialEndsAt, in4Days),
      ),
    });

    for (const sub of trialingSubs) {
      const [owner, org] = await Promise.all([
        db.query.users.findFirst({ where: and(eq(users.organizationId, sub.organizationId), eq(users.role, "owner")) }),
        db.query.organizations.findFirst({ where: eq(organizations.id, sub.organizationId) }),
      ]);
      if (!owner?.email) continue;

      const apiKey = process.env["RESEND_API_KEY"];
      const dashUrl = process.env["DASHBOARD_URL"] ?? "https://app.anthyx.com";
      if (apiKey) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            from: process.env["EMAIL_FROM"] ?? "billing@anthyx.com",
            to: [owner.email],
            subject: "Your free trial ends in 3 days",
            html: `<p>Hi ${owner.name ?? "there"},</p><p>Your free trial for <strong>${org?.name ?? "Anthyx"}</strong> ends in 3 days. Subscribe now to keep uninterrupted access.</p><p><a href="${dashUrl}/billing/upgrade">Choose a plan →</a></p>`,
          }),
        }).catch((e) => console.error("[TrialReminder] Email failed:", e));
      }
    }
  } catch (e) {
    console.error("[TrialReminder] Cron error:", e);
  }
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("[Workers] Shutting down gracefully...");
  await Promise.all([
    postWorker.close(),
    contentWorker.close(),
    planWorker.close(),
    analyticsWorker.close(),
    ingestorWorker.close(),
    notificationWorker.close(),
    feedsWorker.close(),
  ]);
  process.exit(0);
});
