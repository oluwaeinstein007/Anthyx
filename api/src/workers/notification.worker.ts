import { Worker, type Job } from "bullmq";
import { eq, and } from "drizzle-orm";
import { createHmac } from "crypto";
import { db } from "../db/client";
import { webhookEndpoints } from "../db/schema";
import { redisConnection } from "../queue/client";

interface NotificationJobData {
  organizationId: string;
  type: string; // 'post_published' | 'quota_warning' | 'quota_reached' | 'plan_ready' | etc.
  payload: Record<string, unknown>;
  thresholdPct?: number;
}

const worker = new Worker<NotificationJobData>(
  "anthyx-notifications",
  async (job: Job<NotificationJobData>) => {
    const { organizationId, type, payload } = job.data;

    // Fetch all active webhooks for this org that subscribe to this event type
    const endpoints = await db.query.webhookEndpoints.findMany({
      where: and(
        eq(webhookEndpoints.organizationId, organizationId),
        eq(webhookEndpoints.isActive, true),
      ),
    });

    const relevantEndpoints = endpoints.filter(
      (ep) => ep.events?.length === 0 || ep.events?.includes(type),
    );

    if (relevantEndpoints.length === 0) return;

    const eventBody = JSON.stringify({
      event: type,
      organizationId,
      timestamp: new Date().toISOString(),
      data: payload,
    });

    await Promise.allSettled(
      relevantEndpoints.map(async (ep) => {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "X-Anthyx-Event": type,
          "X-Anthyx-Delivery": job.id ?? "",
        };

        // HMAC signature for endpoint verification
        if (ep.secret) {
          const sig = createHmac("sha256", ep.secret).update(eventBody).digest("hex");
          headers["X-Anthyx-Signature"] = `sha256=${sig}`;
        }

        try {
          const res = await fetch(ep.url, {
            method: "POST",
            headers,
            body: eventBody,
            signal: AbortSignal.timeout(10_000),
          });

          if (!res.ok) {
            console.error(`[NotificationWorker] Webhook delivery failed for ${ep.url}: ${res.status}`);
          }
        } catch (err) {
          console.error(`[NotificationWorker] Webhook error for ${ep.url}:`, err);
        }
      }),
    );
  },
  {
    connection: redisConnection,
    concurrency: 10,
  },
);

worker.on("error", (err) => console.error("[NotificationWorker] Error:", err));

export { worker as notificationWorker };
