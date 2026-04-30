import { Queue, QueueEvents } from "bullmq";
import IORedis from "ioredis";

export const redisConnection = new IORedis(process.env["REDIS_URL"] ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// Queue definitions
export const postExecutionQueue = new Queue("anthyx-post-execution", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { age: 86400 }, // keep 24h
    removeOnFail: { age: 604800 }, // keep 7d
  },
});

export const planGenerationQueue = new Queue("anthyx-plan-generation", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 15000 },
    removeOnComplete: { age: 86400 },
    removeOnFail: { age: 604800 },
  },
});

export const contentGenerationQueue = new Queue("anthyx-content-generation", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "fixed", delay: 10000 },
  },
});

export const assetGenerationQueue = new Queue("anthyx-asset-generation", {
  connection: redisConnection,
});

export const analyticsQueue = new Queue("anthyx-analytics", {
  connection: redisConnection,
});

export const ingestorQueue = new Queue("anthyx-ingestor", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 10000 },
    removeOnFail: { age: 604800 },
  },
});

export const notificationQueue = new Queue("anthyx-notifications", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { age: 86400 },
    removeOnFail: { age: 604800 },
  },
});
