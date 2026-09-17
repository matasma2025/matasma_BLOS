import { storage } from "../storage";
import { db } from "../db";
import { documents, cubeMetadata } from "@shared/schema";
import { and, eq } from "drizzle-orm";
import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";

export type BoardSourceSelection =
  | { sourceType: "enterprise"; cubeId: string }
  | { sourceType: "vault"; documentId: string };

export interface AuthorizedBoardSource {
  id: string;
  name: string;
  sourceType: "enterprise" | "vault";
  columns?: string[];
  versions?: string[];
  metadata?: unknown;
}

async function getUserDomain(userId: string) {
  const user = await storage.getUser(userId);
  if (!user) return undefined;
  const membership = await storage.getDomainUserByEmail(user.username.toLowerCase());
  if (!membership || membership.status !== "active") return undefined;
  return { user, membership, domain: await storage.getDomain(membership.domainId) };
}

export async function listAuthorizedBoardSources(userId: string): Promise<AuthorizedBoardSource[]> {
  const context = await getUserDomain(userId);
  if (!context?.domain) return [];

  const [cubes, userDocuments] = await Promise.all([
    storage.getCubes(context.domain.id),
    storage.getDocuments(userId),
  ]);
  const authorizedCubes = [];
  for (const cube of cubes) {
    const access = await storage.getCubeAccessForUser(cube.id, context.user.username);
    if (access?.enabled === 1 || context.membership.role === "admin") {
      const metadata = await db.select({ entities: cubeMetadata.entities, metrics: cubeMetadata.metrics, periods: cubeMetadata.periods })
        .from(cubeMetadata).where(eq(cubeMetadata.cubeId, cube.id)).limit(1);
      const m = metadata[0];
      authorizedCubes.push({
        id: cube.id,
        name: cube.name,
        sourceType: "enterprise" as const,
        columns: Array.isArray(m?.metrics) ? m.metrics as string[] : undefined,
        versions: Array.isArray(m?.periods) ? m.periods as string[] : undefined,
        metadata: m ? { entities: m.entities } : undefined,
      });
    }
  }

  return [
    ...authorizedCubes,
    ...userDocuments.map((document) => ({
      id: document.id,
      name: document.name,
      sourceType: "vault" as const,
    })),
  ];
}

export async function getAuthorizedBoardSource(userId: string, selection: BoardSourceSelection): Promise<AuthorizedBoardSource> {
  const source = (await listAuthorizedBoardSources(userId)).find(
    (candidate) => candidate.id === (selection.sourceType === "enterprise" ? selection.cubeId : selection.documentId)
      && candidate.sourceType === selection.sourceType,
  );
  if (!source) throw new Error("The selected source is not available to this user");
  return source;
}

export async function assertBoardSourceAccess(userId: string, selection: BoardSourceSelection): Promise<void> {
  await getAuthorizedBoardSource(userId, selection);
}

export async function assertBoardDocumentAccess(userId: string, documentId: string): Promise<void> {
  const row = await db.select({ id: documents.id }).from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId))).limit(1);
  if (row.length === 0) throw new Error("The selected document is not available to this user");
}

/** Immutable server-side Vault identity; paths never leave this service. */
export async function getAuthorizedVaultVersion(userId: string, documentId: string) {
  await assertBoardDocumentAccess(userId, documentId);
  const doc = (await db.select().from(documents).where(and(eq(documents.id, documentId), eq(documents.userId, userId))).limit(1))[0];
  if (!doc) throw new Error("The selected document is not available to this user");
  const bytes = await fs.readFile(doc.filePath);
  return {
    documentId: doc.id,
    uploadedAt: doc.uploadedAt.toISOString(),
    contentHash: createHash("sha256").update(bytes).digest("hex"),
  };
}