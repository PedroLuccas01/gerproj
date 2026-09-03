import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { assertCanAssignArea, assertCanEditStaff, requireManagement } from "@/lib/access";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { mapCollaborator } from "@/lib/mappers";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/session";
import { isSupportLogin } from "@/lib/support-admin";
import type { Collaborator } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const access = await requireAccess();
    requireManagement(access);
    const { id } = await params;
    const patch = (await request.json()) as Partial<Collaborator> & { password?: string };
    const existing = await prisma.collaborator.findUnique({ where: { id } });
    if (!existing) return jsonError("Colaborador não encontrado.", 404);
    const account = await prisma.user.findFirst({
      where: { email: existing.email.toLowerCase() },
    });
    assertCanEditStaff(access, { isAdmin: account?.isAdmin, area: existing.area });
    if (patch.area !== undefined) {
      assertCanAssignArea(access, patch.area, existing.area);
    }

    const password = patch.password?.trim() ?? "";
    if (password && password.length < 6) {
      return jsonError("A senha deve ter pelo menos 6 caracteres.");
    }
    if (password && isSupportLogin(existing.email)) {
      return jsonError("A senha desta conta não pode ser alterada por aqui.");
    }

    const nextEmail = patch.email !== undefined ? patch.email.trim().toLowerCase() : existing.email;
    const updated = await prisma.collaborator.update({
      where: { id },
      data: {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.email !== undefined ? { email: nextEmail } : {}),
        ...(patch.role !== undefined ? { role: patch.role } : {}),
        ...(patch.area !== undefined ? { area: patch.area } : {}),
        ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
        ...(patch.active !== undefined ? { active: patch.active } : {}),
      },
    });

    if (account && !isSupportLogin(account.email)) {
      await prisma.user.update({
        where: { id: account.id },
        data: {
          ...(patch.name !== undefined ? { name: updated.name } : {}),
          ...(patch.email !== undefined ? { email: nextEmail } : {}),
          ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
        },
      });
    }

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
    const existing = await prisma.collaborator.findUnique({ where: { id } });
    if (!existing) return jsonError("Colaborador não encontrado.", 404);
    const account = await prisma.user.findFirst({
      where: { email: existing.email.toLowerCase() },
      select: { isAdmin: true },
    });
    assertCanEditStaff(access, { isAdmin: account?.isAdmin, area: existing.area });
    await prisma.collaborator.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
