import { NextResponse } from "next/server";
import {
  assertCanDeleteProjectHistoryEntry,
  assertCanEditProjectHistoryEntry,
  loadProjectForAccess,
} from "@/lib/access";
import { handleApiError, jsonError } from "@/lib/api-utils";
import type { CommentAttachmentInput } from "@/lib/comment-attachments";
import {
  attachmentDataFromInput,
  clearAttachmentData,
  deleteCommentAttachment,
} from "@/lib/comment-blob";
import { mapCollaborator } from "@/lib/mappers";
import { mapProjectHistoryEntry } from "@/lib/project-history-mapper";
import { parseMentionIds, projectTeamMembers } from "@/lib/project-history";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/session";

type Params = { params: Promise<{ id: string; entryId: string }> };

const HISTORY_INCLUDE = { mentions: true } as const;

export async function PATCH(request: Request, { params }: Params) {
  try {
    const access = await requireAccess();
    const { id: projectId, entryId } = await params;

    const existing = await prisma.projectHistoryEntry.findFirst({
      where: { id: entryId, projectId },
      include: HISTORY_INCLUDE,
    });
    if (!existing) return jsonError("Registro não encontrado.", 404);

    await assertCanEditProjectHistoryEntry(access, existing);

    const body = (await request.json()) as {
      content?: string;
      attachment?: CommentAttachmentInput | null;
      removeAttachment?: boolean;
    };
    const content = body.content?.trim() ?? "";
    const nextAttachment = body.removeAttachment
      ? null
      : body.attachment
        ? attachmentDataFromInput(body.attachment)
        : undefined;
    const hasAttachment = body.removeAttachment && !body.attachment
      ? false
      : Boolean(nextAttachment ?? existing.attachmentUrl);
    if (!content && !hasAttachment) return jsonError("Informe o comentário ou anexe um arquivo.");

    const project = await loadProjectForAccess(projectId);
    const collaborators = await prisma.collaborator.findMany({ where: { active: true } });
    const members = projectTeamMembers(
      {
        leaderId: project.leaderId,
        teamIds: project.team.map((row) => row.collaboratorId),
      },
      collaborators.map(mapCollaborator),
    );
    const mentionIds = parseMentionIds(content || existing.content, members);

    if (nextAttachment !== undefined && existing.attachmentPathname) {
      const keepPath =
        nextAttachment?.attachmentPathname === existing.attachmentPathname ? existing.attachmentPathname : null;
      if (!keepPath) await deleteCommentAttachment(existing.attachmentPathname);
    }

    await prisma.projectHistoryMention.deleteMany({ where: { entryId } });
    const updated = await prisma.projectHistoryEntry.update({
      where: { id: entryId },
      data: {
        content: content || existing.content,
        ...(nextAttachment === null
          ? clearAttachmentData()
          : nextAttachment
            ? nextAttachment
            : {}),
        mentions: mentionIds.length
          ? { create: mentionIds.map((collaboratorId) => ({ collaboratorId })) }
          : undefined,
      },
      include: HISTORY_INCLUDE,
    });

    return NextResponse.json(mapProjectHistoryEntry(updated));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const access = await requireAccess();
    await assertCanDeleteProjectHistoryEntry(access);
    const { id: projectId, entryId } = await params;

    const existing = await prisma.projectHistoryEntry.findFirst({
      where: { id: entryId, projectId },
    });
    if (!existing) return jsonError("Registro não encontrado.", 404);

    await deleteCommentAttachment(existing.attachmentPathname);
    await prisma.projectHistoryEntry.delete({ where: { id: entryId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
