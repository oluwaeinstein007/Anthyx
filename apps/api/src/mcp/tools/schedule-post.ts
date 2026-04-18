import { z } from "zod";
import { schedulePostJob } from "../../queue/jobs";

export const schedulePostTool = {
  name: "schedule_post",
  description: "Schedule a post for execution at a specific time via BullMQ.",
  inputSchema: z.object({
    postId: z.string().uuid(),
    scheduledAt: z.string().describe("ISO8601 datetime for when to publish"),
  }),
  async handler({ postId, scheduledAt }: { postId: string; scheduledAt: string }) {
    const date = new Date(scheduledAt);
    const jobId = await schedulePostJob(postId, date);
    return { jobId, scheduledAt: date.toISOString() };
  },
};
