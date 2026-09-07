import assert from "node:assert/strict";
import test from "node:test";
import {
  toPublicBoard,
  toPublicAutomationLog,
  toPublicChat,
  toPublicDocument,
  toPublicDocumentVersion,
  toPublicEnterpriseDocument,
} from "../../server/publicDtos";

const createdAt = new Date("2025-01-01T00:00:00.000Z");

test("public chat and board DTOs retain client fields without owner IDs", () => {
  const chat = toPublicChat({
    id: "chat-1", userId: "private-user", title: "Analysis", preview: null, createdAt,
  });
  const board = toPublicBoard({
    id: "board-1", userId: "private-user", templateId: "template-1", title: "Board",
    description: "Description", settings: { cubeId: "cube-1" }, createdAt,
  });

  assert.deepEqual(chat, { id: "chat-1", title: "Analysis", preview: null, createdAt });
  assert.equal("userId" in chat, false);
  assert.equal("userId" in board, false);
  assert.equal(board.templateId, "template-1");
  assert.deepEqual(board.settings, { cubeId: "cube-1" });
});

test("public document DTOs omit paths, owner IDs, and cloud provider identifiers", () => {
  const document = toPublicDocument({
    id: "doc-1", userId: "private-user", name: "report.pdf", filePath: "uploads/secret",
    fileSize: "123", fileType: "application/pdf", cloudSource: "drive",
    cloudFileId: "cloud-id", cloudUrl: "https://private.example", uploadedAt: createdAt,
  });
  const enterprise = toPublicEnterpriseDocument({
    id: "enterprise-1", companyId: "private-company", uploadedBy: "private-user",
    name: "report.pdf", filePath: "uploads/secret", fileSize: "456",
    fileType: "application/pdf", source: "manual", uploadedAt: createdAt,
    processingStatus: "completed", chunkCount: 4, errorMessage: null, cubeId: "cube-1",
  });

  for (const key of ["userId", "filePath", "cloudSource", "cloudFileId", "cloudUrl"]) {
    assert.equal(key in document, false, `${key} must not be public`);
  }
  for (const key of ["companyId", "uploadedBy", "filePath"]) {
    assert.equal(key in enterprise, false, `${key} must not be public`);
  }
  assert.equal(enterprise.fileName, "report.pdf");
  assert.equal(enterprise.processingStatus, "completed");
  assert.equal(enterprise.chunkCount, 4);
  assert.equal(enterprise.cubeId, "cube-1");
});

test("version history exposes uploader display name but not path or metadata", () => {
  const version = toPublicDocumentVersion({
    id: "version-1", fileName: "report.pdf", version: 2, fileSize: "789",
    fileType: "application/pdf", source: "manual", isActive: true, uploadedAt: createdAt,
    uploadedBy: "Alex Example", cubeId: "cube-1",
  });

  assert.equal(version.uploadedBy, "Alex Example");
  assert.equal("filePath" in version, false);
  assert.equal("metadata" in version, false);
  assert.equal(version.version, 2);
});

test("automation log exposes a display name without company, user ID, or details", () => {
  const log = toPublicAutomationLog({
    id: "log-1",
    companyId: "private-company",
    status: "success",
    triggerType: "manual",
    triggeredBy: "private-user",
    filesDownloaded: 2,
    filesProcessed: 2,
    filesFailed: 0,
    newVersionsCreated: 1,
    archivedVersions: 1,
    errorMessage: null,
    details: { internal: true },
    startedAt: createdAt,
    completedAt: createdAt,
    createdAt,
  }, "Alex Example");

  assert.equal(log.triggeredBy, "Alex Example");
  assert.equal("companyId" in log, false);
  assert.equal("details" in log, false);
});