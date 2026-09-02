import { NextResponse } from "next/server";
import { assertCanAssignArea, requireManagement } from "@/lib/access";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { mapCollaborator } from "@/lib/mappers";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/session";
import type { CollaboratorDraft } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const access = await requireAccess();
    requireManagement(access);
    const draft = (await request.json()) as CollaboratorDraft;
    if (!draft?.name?.trim() || !draft.role?.trim()) {
      return jsonError("Nome e cargo são obrigatórios.");
    }
    assertCanAssignArea(access, draft.area);
    const created = await prisma.collaborator.create({
      data: {
        name: draft.name.trim(),
        email: draft.email?.trim().toLowerCase() ?? "",
        role: draft.role.trim(),
        area: draft.area,
        phone: draft.phone ?? "",
        active: draft.active ?? true,
      },
    });
    return NextResponse.json(mapCollaborator(created));
  } catch (error) {
    return handleApiError(error);
  }
}
