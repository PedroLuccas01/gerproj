import { NextResponse } from "next/server";
import { requireManagement } from "@/lib/access";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { mapProject, parseDate } from "@/lib/mappers";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/session";
import type { ProjectDraft } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const access = await requireAccess();
    requireManagement(access);
    const draft = (await request.json()) as ProjectDraft;
    if (!draft?.name?.trim()) return jsonError("Nome do projeto é obrigatório.");
    const created = await prisma.project.create({
      data: {
        name: draft.name.trim(),
        description: draft.description ?? "",
        clientId: draft.clientId,
        leaderId: draft.leaderId,
        durationDays: draft.durationDays,
        status: draft.status,
        startDate: parseDate(draft.startDate),
        endDate: parseDate(draft.endDate),
        budget: draft.budget ?? 0,
        budgetAutomacao: draft.budgetByArea?.automacao ?? 0,
        budgetMecanica: draft.budgetByArea?.mecanica ?? 0,
        budgetHardware: draft.budgetByArea?.hardware ?? 0,
        budgetSoftware: draft.budgetByArea?.software ?? 0,
        notes: draft.notes ?? "",
        team: {
          create: (draft.teamIds ?? []).map((collaboratorId) => ({ collaboratorId })),
        },
      },
      include: { team: true },
    });
    return NextResponse.json(mapProject(created));
  } catch (error) {
    return handleApiError(error);
  }
}
