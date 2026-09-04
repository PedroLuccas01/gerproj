import type { ProjectHistoryEntry as DbEntry, ProjectHistoryMention } from "@prisma/client";
import type { ProjectHistoryEntry } from "./types";

export type DbHistoryEntry = DbEntry & { mentions: ProjectHistoryMention[] };

export function mapProjectHistoryEntry(row: DbHistoryEntry): ProjectHistoryEntry {
  return {
    id: row.id,
    projectId: row.projectId,
    authorId: row.authorId,
    authorName: row.authorName,
    authorEmail: row.authorEmail,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    mentionIds: row.mentions.map((mention) => mention.collaboratorId),
    attachmentUrl: row.attachmentUrl,
    attachmentPathname: row.attachmentPathname,
    attachmentName: row.attachmentName,
    attachmentMime: row.attachmentMime,
    attachmentSize: row.attachmentSize,
  };
}
