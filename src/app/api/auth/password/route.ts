import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const access = await requireAccess();
    const body = (await request.json()) as { currentPassword?: string; newPassword?: string };
    const currentPassword = body.currentPassword ?? "";
    const newPassword = body.newPassword ?? "";
    if (!currentPassword || !newPassword) {
      return jsonError("Informe a senha atual e a nova senha.");
    }
    if (newPassword.length < 6) {
      return jsonError("A nova senha deve ter pelo menos 6 caracteres.");
    }

    const user = await prisma.user.findUnique({ where: { id: access.id } });
    if (!user) return jsonError("Usuário não encontrado.", 404);
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      return jsonError("Senha atual incorreta.", 401);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(newPassword, 10) },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
