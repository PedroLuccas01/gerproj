import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-utils";
import {
  historyNotificationCopy,
  historyNotificationHref,
} from "@/lib/history-notifications";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/session";

export async function GET() {
  try {
    const access = await requireAccess();
    if (!access.collaboratorId) {
      return NextResponse.json({ items: [] });
    }

    const rows = await prisma.projectHistoryNotification.findMany({
      where: {
        collaboratorId: access.collaboratorId,
        readAt: null,
      },
      include: {
        entry: {
          include: {
            project: { select: { name: true } },
            task: { select: { id: true, seq: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const items = rows.map((row) => {
      const copy = historyNotificationCopy({
        reason: row.reason,
        taskId: row.entry.taskId,
        taskSeq: row.entry.task?.seq ?? null,
        taskName: row.entry.task?.name ?? null,
        projectName: row.entry.project.name,
        authorName: row.entry.authorName,
      });
      return {
        id: `history:${row.id}`,
        notificationId: row.id,
        title: copy.title,
        description: copy.description,
        href: historyNotificationHref(row.entry.projectId, row.entry.taskId),
        tone: copy.tone,
      };
    });

    return NextResponse.json({ items });
  } catch (error) {
    return handleApiError(error);
  }
}
