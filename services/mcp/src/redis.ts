import { Redis } from "ioredis";
import { Queue } from "bullmq";

export const redisConnection = new Redis(
  process.env["REDIS_URL"] ?? "redis://localhost:6379",
  { maxRetriesPerRequest: null, enableReadyCheck: false },
);

export const postExecutionQueue = new Queue("anthyx-post-execution", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { age: 86400 },
    removeOnFail: { age: 604800 },
  },
});
