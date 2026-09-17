import { z } from "zod";

const sourceIdSchema = z.string().uuid();

export const boardSourceReferenceSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("enterprise"), cubeId: sourceIdSchema }).strict(),
  z.object({ type: z.literal("vault"), documentIds: z.array(sourceIdSchema).min(1).max(100) }).strict(),
  z.object({ type: z.literal("uploaded-table"), datasetId: sourceIdSchema }).strict(),
]);

export type BoardSourceReference = z.infer<typeof boardSourceReferenceSchema>;
