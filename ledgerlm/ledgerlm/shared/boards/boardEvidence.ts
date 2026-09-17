import { z } from "zod";

export const boardEvidenceManifestSchema = z.object({
  sourceType: z.enum(["enterprise", "vault", "uploaded-table"]),
  sourceIds: z.array(z.string().uuid()).max(100),
  sourceVersions: z.array(z.object({
    id: z.string().uuid(),
    version: z.string().max(500),
  }).strict()).max(100).default([]),
  scopeHash: z.string().max(128).optional(),
  configHash: z.string().max(128).optional(),
  generatedAt: z.string().datetime(),
}).strict();

export type BoardEvidenceManifest = z.infer<typeof boardEvidenceManifestSchema>;
