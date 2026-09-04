import { NextResponse } from "next/server";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const access = await requireAccess();
    if (!access.collaboratorId) return NextResponse.json({ ok: true });

    const body = (await request.json()) as {
      ids?: string[];
      entryIds?: string[];
      projectId?: string;
      taskId?: string | null;
    };

    const ids = body.ids?.filter(Boolean) ?? [];
    const entryIds = body.entryIds?.filter(Boolean) ?? [];

    if (!ids.length && !entryIds.length && !body.projectId) {
      return jsonError("Informe as notificações a marcar como lidas.");
    }

    const now = new Date();
    const where = {
      collaboratorId: access.collaboratorId,
      readAt: null as Date | null,
    };

    if (ids.length) {
      await prisma.projectHistoryNotification.updateMany({
        where: { ...where, id: { in: ids } },
        data: { readAt: now },
      });
    }

    if (entryIds.length) {
      await prisma.projectHistoryNotification.updateMany({
        where: { ...where, entryId: { in: entryIds } },
        data: { readAt: now },
      });
    }

    if (body.projectId) {
      await prisma.projectHistoryNotification.updateMany({
        where: {
          ...where,
          entry: {
            projectId: body.projectId,
            ...(body.taskId ? { taskId: body.taskId } : { taskId: null }),
          },
        },
        data: { readAt: now },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
