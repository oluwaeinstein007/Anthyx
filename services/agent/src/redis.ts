import { Redis } from "ioredis";
import { Queue } from "bullmq";

export const redisConnection = new Redis(process.env["REDIS_URL"] ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const contentGenerationQueue = new Queue("anthyx-content-generation", { connection: redisConnection });
