import { NextResponse } from "next/server";
import { requireManagement } from "@/lib/access";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/session";
import { isSupportLogin } from "@/lib/support-admin";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const access = await requireAccess();
    requireManagement(access);
    const { id } = await params;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return jsonError("Usuário não encontrado.", 404);
    if (isSupportLogin(user.email)) return jsonError("Esta conta não pode ser recusada.");
    if (user.isAdmin) return jsonError("Não é possível recusar um administrador.");

    await prisma.user.update({
      where: { id },
      data: { status: "rejected" },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
