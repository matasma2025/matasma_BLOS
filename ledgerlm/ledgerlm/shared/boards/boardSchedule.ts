import { z } from "zod";

export const boardScheduleConfigurationSchema = z.object({
  enabled: z.boolean().default(false),
  frequency: z.enum(["15-minutes", "hourly", "daily", "weekly", "monthly", "custom"]),
  interval: z.number().int().min(1).max(10_000).optional(),
  intervalUnit: z.enum(["minutes", "hours", "days", "weeks", "months"]).optional(),
  timezone: z.string().trim().min(1).max(100),
  startAt: z.string().datetime(),
  nextRunAt: z.string().datetime().optional(),
}).strict().superRefine((value, ctx) => {
  try { new Intl.DateTimeFormat("en-US", { timeZone: value.timezone }).format(); }
  catch { ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["timezone"], message: "Invalid IANA timezone" }); }
  if (value.frequency === "custom" && (!value.interval || !value.intervalUnit)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["interval"], message: "Custom schedules require interval and intervalUnit" });
  }
});

export type BoardScheduleConfiguration = z.infer<typeof boardScheduleConfigurationSchema>;
