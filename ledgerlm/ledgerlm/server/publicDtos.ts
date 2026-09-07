/**
 * Explicit allow-list serializers for records returned from public API routes.
 * Database records must remain complete because internal processing uses their
 * ownership and storage-path fields after a request has been authorized.
 */

export interface PublicChatDto {
  id: string;
  title: string;
  preview: string | null;
  createdAt: Date;
}

export interface PublicBoardDto {
  id: string;
  templateId: string | null;
  title: string;
  description: string | null;
  settings: unknown;
  createdAt: Date;
}

export interface PublicDocumentDto {
  id: string;
  name: string;
  fileSize: string;
  fileType: string;
  uploadedAt: Date;
}

export interface PublicEnterpriseDocumentDto {
  id: string;
  fileName: string;
  fileSize: number | string;
  fileType: string;
  source: string;
  uploadedAt: Date;
  processingStatus?: string;
  chunkCount?: number;
  errorMessage?: string | null;
  cubeId?: string | null;
  version?: number;
  isActive?: boolean;
}

export interface PublicDocumentVersionDto {
  id: string;
  fileName: string;
  version: number;
  fileSize: string;
  fileType: string;
  source: string;
  isActive: boolean;
  uploadedAt: Date;
  /** Display name, retaining the property consumed by the UI. */
  uploadedBy: string;
  cubeId: string | null;
}

export interface PublicAutomationLogDto {
  id: string;
  status: string;
  triggerType: string;
  triggeredBy?: string;
  filesDownloaded: number;
  filesProcessed: number;
  filesFailed: number;
  newVersionsCreated: number;
  archivedVersions: number;
  errorMessage?: string | null;
  startedAt: Date;
  completedAt?: Date | null;
  createdAt: Date;
}

export const toPublicChat = (chat: {
  id: string; title: string; preview: string | null; createdAt: Date;
}): PublicChatDto => ({
  id: chat.id, title: chat.title, preview: chat.preview, createdAt: chat.createdAt,
});

export const toPublicBoard = (board: {
  id: string; templateId: string | null; title: string; description: string | null;
  settings: unknown; createdAt: Date;
}): PublicBoardDto => ({
  id: board.id, templateId: board.templateId, title: board.title,
  description: board.description, settings: board.settings, createdAt: board.createdAt,
});

export const toPublicDocument = (document: {
  id: string; name: string; fileSize: string; fileType: string; uploadedAt: Date;
}): PublicDocumentDto => ({
  id: document.id, name: document.name, fileSize: document.fileSize,
  fileType: document.fileType, uploadedAt: document.uploadedAt,
});

export const toPublicEnterpriseDocument = (document: {
  id: string; fileName?: string; name?: string; fileSize: number | string; fileType: string;
  source: string; uploadedAt: Date; processingStatus?: string; chunkCount?: number;
  errorMessage?: string | null; cubeId?: string | null; version?: number; isActive?: number | boolean;
}): PublicEnterpriseDocumentDto => ({
  id: document.id,
  fileName: document.fileName ?? document.name ?? "",
  fileSize: document.fileSize,
  fileType: document.fileType,
  source: document.source,
  uploadedAt: document.uploadedAt,
  ...(document.processingStatus !== undefined && { processingStatus: document.processingStatus }),
  ...(document.chunkCount !== undefined && { chunkCount: document.chunkCount }),
  ...(document.errorMessage !== undefined && { errorMessage: document.errorMessage }),
  ...(document.cubeId !== undefined && { cubeId: document.cubeId }),
  ...(document.version !== undefined && { version: document.version }),
  ...(document.isActive !== undefined && { isActive: document.isActive === true || document.isActive === 1 }),
});

export const toPublicDocumentVersion = (version: PublicDocumentVersionDto): PublicDocumentVersionDto => ({
  id: version.id, fileName: version.fileName, version: version.version,
  fileSize: version.fileSize, fileType: version.fileType, source: version.source,
  isActive: version.isActive, uploadedAt: version.uploadedAt,
  uploadedBy: version.uploadedBy, cubeId: version.cubeId,
});

export const toPublicAutomationLog = (
  log: Omit<PublicAutomationLogDto, "triggeredBy">,
  triggeredBy?: string,
): PublicAutomationLogDto => ({
  id: log.id,
  status: log.status,
  triggerType: log.triggerType,
  ...(triggeredBy && { triggeredBy }),
  filesDownloaded: log.filesDownloaded,
  filesProcessed: log.filesProcessed,
  filesFailed: log.filesFailed,
  newVersionsCreated: log.newVersionsCreated,
  archivedVersions: log.archivedVersions,
  ...(log.errorMessage !== undefined && { errorMessage: log.errorMessage }),
  startedAt: log.startedAt,
  ...(log.completedAt !== undefined && { completedAt: log.completedAt }),
  createdAt: log.createdAt,
});