import { z } from "zod";

export const boardScheduleConfigurationSchema = z.object({
  enabled: z.boolean().default(false),
  frequency: z.enum(["15-minutes", "hourly", "daily", "weekly", "monthly", "custom"]),
  interval: z.number().int().min(1).max(10_000).optional(),
  intervalUnit: z.enum(["minutes", "hours", "days", "weeks", "months"]).optional(),
  timezone: z.string().trim().min(1).max(100),
  startAt: z.string().datetime(),
  nextRunAt: z.string().datetime().optional(),
}).strict();

export type BoardScheduleConfiguration = z.infer<typeof boardScheduleConfigurationSchema>;
