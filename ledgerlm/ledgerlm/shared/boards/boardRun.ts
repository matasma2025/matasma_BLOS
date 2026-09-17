import { z } from "zod";

export const BOARD_RESULT_SCHEMA_VERSION = 2;
export const BOARD_FORMULA_ENGINE_VERSION = "deterministic-board-v1";

export const boardRunStatusSchema = z.enum([
  "queued",
  "claiming",
  "running",
  "loading_source",
  "calculating",
  "generating_overview",
  "generating_narrative",
  "validating",
  "persisting",
  "complete",
  "partial",
  "cancel_requested",
  "cancelled",
  "failed",
  "error",
]);

export const boardRunTriggerSchema = z.enum(["manual", "scheduled", "rerun"]);

export type BoardRunStatus = z.infer<typeof boardRunStatusSchema>;
export type BoardRunTrigger = z.infer<typeof boardRunTriggerSchema>;
