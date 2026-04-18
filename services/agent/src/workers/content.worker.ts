import { Worker, type Job } from "bullmq";
import { redisConnection } from "../redis.js";
import { generateContentForPlan } from "../orchestrator.js";

interface ContentJobData {
  planId: string;
  organizationId: string;
}

const worker = new Worker<ContentJobData>(
  "anthyx-content-generation",
  async (job: Job<ContentJobData>) => {
    const { planId, organizationId } = job.data;
    console.log(`[ContentWorker] Generating content for plan ${planId}`);
    await generateContentForPlan(planId, organizationId);
    console.log(`[ContentWorker] Content generation complete for plan ${planId}`);
  },
  { connection: redisConnection, concurrency: 3 },
);

worker.on("failed", (job, err) => {
  console.error(`[ContentWorker] Job ${job?.id} failed:`, err);
});

export { worker as contentWorker };
