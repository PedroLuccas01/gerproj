import { NextResponse } from "next/server";
import { assertCanAssignArea, requireManagement } from "@/lib/access";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/session";
import { isSupportLogin } from "@/lib/support-admin";
import type { Area } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const access = await requireAccess();
    requireManagement(access);
    const { id } = await params;
    const body = (await request.json()) as { role?: string; area?: Area };
    const role = body.role?.trim() ?? "";
    const area = body.area;
    if (!role) return jsonError("Informe o cargo.");
    if (!area) return jsonError("Informe a área.");
    assertCanAssignArea(access, area);

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return jsonError("Usuário não encontrado.", 404);
    if (isSupportLogin(user.email)) return jsonError("Esta conta não pode ser alterada por aqui.");

    const email = user.email.toLowerCase();
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { status: "active" },
      });
      const collab = await tx.collaborator.findFirst({ where: { email } });
      if (collab) {
        await tx.collaborator.update({
          where: { id: collab.id },
          data: { name: user.name, role, area, active: true },
        });
      } else {
        await tx.collaborator.create({
          data: {
            name: user.name,
            email,
            role,
            area,
            phone: "",
            active: true,
          },
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
