import { z } from "zod";

export const entityPnlCubePlanUploadSchema = z.object({
  entity: z.string().trim().min(1).max(200),
  confirmedBasis: z.enum(["mINR-ytd", "mINR-mtd"]),
  usdExchangeRates: z.record(z.string().regex(/^CF\d{2} \d{4}$/), z.number().finite().positive().max(1_000_000)).default({}),
  expectedRevision: z.number().int().min(0).optional(),
  previewHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
}).strict();

export interface EntityPnlCubePlanSummary {
  entity: string;
  sourceName: string;
  revision: number;
  updatedAt: string | null;
  previewHash: string;
  sourceUnit: "mINR";
  periodBasis: "ytd" | "mtd";
  records: number;
  scenarios: Array<{ scenario: string; populated: number; missing: number; months: number[] }>;
  usdExchangeRates: Record<string, number>;
  warnings: string[];
}
