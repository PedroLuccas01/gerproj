import { NextResponse } from "next/server";
import {
  assertCanViewProject,
  assertCanWriteProjectHistory,
  loadProjectForAccess,
} from "@/lib/access";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { mapProjectHistoryEntry } from "@/lib/project-history-mapper";
import { parseMentionIds, projectTeamMembers } from "@/lib/project-history";
import { mapCollaborator } from "@/lib/mappers";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/session";

type Params = { params: Promise<{ id: string }> };

const HISTORY_INCLUDE = { mentions: true } as const;

export async function GET(request: Request, { params }: Params) {
  try {
    const access = await requireAccess();
    const { id: projectId } = await params;
    await assertCanViewProject(access, projectId);

    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim() ?? "";

    const rows = await prisma.projectHistoryEntry.findMany({
      where: {
        projectId,
        ...(q ? { content: { contains: q, mode: "insensitive" } } : {}),
      },
      include: HISTORY_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json({ items: rows.map(mapProjectHistoryEntry) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const access = await requireAccess();
    const { id: projectId } = await params;
    await assertCanWriteProjectHistory(access, projectId);

    const body = (await request.json()) as { content?: string };
    const content = body.content?.trim() ?? "";
    if (!content) return jsonError("Informe o conteúdo do registro.");

    const project = await loadProjectForAccess(projectId);
    const collaborators = await prisma.collaborator.findMany({ where: { active: true } });
    const members = projectTeamMembers(
      {
        leaderId: project.leaderId,
        teamIds: project.team.map((row) => row.collaboratorId),
      },
      collaborators.map(mapCollaborator),
    );
    const mentionIds = parseMentionIds(content, members);

    const created = await prisma.projectHistoryEntry.create({
      data: {
        projectId,
        authorId: access.id,
        authorName: access.name,
        authorEmail: access.email,
        content,
        mentions: mentionIds.length
          ? { create: mentionIds.map((collaboratorId) => ({ collaboratorId })) }
          : undefined,
      },
      include: HISTORY_INCLUDE,
    });

    return NextResponse.json(mapProjectHistoryEntry(created));
  } catch (error) {
    return handleApiError(error);
  }
}
