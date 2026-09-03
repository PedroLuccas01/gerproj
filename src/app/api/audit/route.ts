import { NextResponse } from "next/server";
import { requireManagement } from "@/lib/access";
import { mapAuditEvent } from "@/lib/audit";
import { isAuditField } from "@/lib/audit-shared";
import { handleApiError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/session";

export async function GET(request: Request) {
  try {
    const access = await requireAccess();
    requireManagement(access);

    const url = new URL(request.url);
    const field = url.searchParams.get("field");
    const entityType = url.searchParams.get("entityType");
    const entityId = url.searchParams.get("entityId");
    const rawLimit = Number(url.searchParams.get("limit") ?? 100);
    const take = Number.isFinite(rawLimit) ? Math.min(200, Math.max(1, Math.trunc(rawLimit))) : 100;

    const items = await prisma.auditLog.findMany({
      where: {
        ...(isAuditField(field) ? { field } : {}),
        ...(entityType === "project" || entityType === "user" ? { entityType } : {}),
        ...(entityId ? { entityId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take,
    });

    return NextResponse.json({
      items: items.map(mapAuditEvent).filter((item) => item !== null),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
