import { NextResponse } from "next/server";
import { requireManagement } from "@/lib/access";
import { recordAudit, statusAudit, toAuditActor } from "@/lib/audit";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { mapTask } from "@/lib/mappers";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/session";
import type { TaskPhase } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const access = await requireAccess();
    requireManagement(access);
    const body = (await request.json()) as {
      projectId?: string;
      phase?: TaskPhase;
      parentId?: string | null;
      name?: string;
    };
    if (!body.projectId || !body.phase) return jsonError("Projeto e fase são obrigatórios.");

    const parentId = body.parentId ?? null;
    const [project, orderAgg, seqAgg] = await Promise.all([
      prisma.project.findUnique({
        where: { id: body.projectId },
        select: { id: true, status: true, name: true },
      }),
      prisma.task.aggregate({
        where: { projectId: body.projectId, phase: body.phase, parentId },
        _max: { order: true },
      }),
      prisma.task.aggregate({
        where: { projectId: body.projectId },
        _max: { seq: true },
      }),
    ]);
    if (!project) return jsonError("Projeto não encontrado.", 404);

    const created = await prisma.task.create({
      data: {
        projectId: body.projectId,
        parentId,
        phase: body.phase,
        name: body.name ?? "Nova tarefa",
        seq: (seqAgg._max.seq ?? 0) + 1,
        order: (orderAgg._max.order ?? -1) + 1,
        durationDays: 1,
      },
    });

    if (project.status === "concluido") {
      await prisma.project.update({
        where: { id: body.projectId },
        data: { status: "em_andamento" },
      });
      const entry = statusAudit({
        actor: toAuditActor(access),
        projectId: body.projectId,
        projectName: project.name,
        from: "concluido",
        to: "em_andamento",
        action: "auto",
      });
      if (entry) await recordAudit(entry);
    }

    return NextResponse.json(mapTask(created));
  } catch (error) {
    return handleApiError(error);
  }
}
