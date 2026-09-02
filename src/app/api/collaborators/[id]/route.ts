import { NextResponse } from "next/server";
import { assertCanAssignArea, requireManagement } from "@/lib/access";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { mapCollaborator } from "@/lib/mappers";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/session";
import type { Collaborator } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const access = await requireAccess();
    requireManagement(access);
    const { id } = await params;
    const patch = (await request.json()) as Partial<Collaborator>;
    const existing = await prisma.collaborator.findUnique({ where: { id } });
    if (!existing) return jsonError("Colaborador não encontrado.", 404);
    if (patch.area !== undefined) {
      assertCanAssignArea(access, patch.area, existing.area);
    }
    const updated = await prisma.collaborator.update({
      where: { id },
      data: {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.email !== undefined ? { email: patch.email } : {}),
        ...(patch.role !== undefined ? { role: patch.role } : {}),
        ...(patch.area !== undefined ? { area: patch.area } : {}),
        ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
        ...(patch.active !== undefined ? { active: patch.active } : {}),
      },
    });
    return NextResponse.json(mapCollaborator(updated));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const access = await requireAccess();
    requireManagement(access);
    const { id } = await params;
    await prisma.collaborator.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
