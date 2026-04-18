/**
 * Worker process entry point.
 * Starts all BullMQ workers — runs separately from the API server.
 */
import { postWorker } from "./post.worker";
import { contentWorker } from "./content.worker";
import { planWorker } from "./plan.worker";
import { analyticsWorker } from "./analytics.worker";
import { ingestorWorker } from "./ingestor.worker";
import "./overage.worker";

console.log("[Workers] Starting all BullMQ workers...");
console.log("[Workers] Post execution worker: active");
console.log("[Workers] Content generation worker: active");
console.log("[Workers] Plan generation worker: active");
console.log("[Workers] Analytics worker: active");
console.log("[Workers] Overage cron worker: active");
console.log("[Workers] Ingestor worker: active");

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("[Workers] Shutting down gracefully...");
  await Promise.all([
    postWorker.close(),
    contentWorker.close(),
    planWorker.close(),
    analyticsWorker.close(),
    ingestorWorker.close(),
  ]);
  process.exit(0);
});
