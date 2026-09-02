import { NextResponse } from "next/server";
import { requireManagement } from "@/lib/access";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { mapProject, parseDate } from "@/lib/mappers";
import { prisma } from "@/lib/prisma";
import { syncShareExpiry } from "@/lib/project-share";
import { requireAccess } from "@/lib/session";
import type { Project } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const access = await requireAccess();
    requireManagement(access);
    const { id } = await params;
    const patch = (await request.json()) as Partial<Project>;
    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) return jsonError("Projeto não encontrado.", 404);

    if (patch.teamIds) {
      await prisma.projectTeam.deleteMany({ where: { projectId: id } });
      if (patch.teamIds.length) {
        await prisma.projectTeam.createMany({
          data: patch.teamIds.map((collaboratorId) => ({ projectId: id, collaboratorId })),
        });
      }
    }

    const updated = await prisma.project.update({
      where: { id },
      data: {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.clientId !== undefined ? { clientId: patch.clientId } : {}),
        ...(patch.leaderId !== undefined ? { leaderId: patch.leaderId } : {}),
        ...(patch.durationDays !== undefined ? { durationDays: patch.durationDays } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.startDate !== undefined ? { startDate: parseDate(patch.startDate) } : {}),
        ...(patch.endDate !== undefined ? { endDate: parseDate(patch.endDate) } : {}),
        ...(patch.budget !== undefined ? { budget: patch.budget } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
        ...(patch.budgetByArea
          ? {
              budgetAutomacao: patch.budgetByArea.automacao,
              budgetMecanica: patch.budgetByArea.mecanica,
              budgetHardware: patch.budgetByArea.hardware,
              budgetSoftware: patch.budgetByArea.software,
            }
          : {}),
      },
      include: { team: true },
    });
    if (patch.endDate !== undefined) {
      await syncShareExpiry(id, updated.endDate);
    }
    return NextResponse.json(mapProject(updated));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const access = await requireAccess();
    requireManagement(access);
    const { id } = await params;
    await prisma.project.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
