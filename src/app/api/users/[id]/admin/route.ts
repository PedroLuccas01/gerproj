import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/access";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/session";
import { isSupportLogin } from "@/lib/support-admin";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const access = await requireAccess();
    requireAdmin(access);
    const { id } = await params;
    const body = (await request.json()) as { isAdmin?: boolean };
    if (typeof body.isAdmin !== "boolean") return jsonError("Informe se o usuário é admin.");

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return jsonError("Usuário não encontrado.", 404);
    if (isSupportLogin(user.email) && !body.isAdmin) {
      return jsonError("O administrador principal não pode perder o acesso admin.");
    }
    if (user.status !== "active") {
      return jsonError("Aprove o usuário antes de torná-lo administrador.");
    }

    await prisma.user.update({
      where: { id },
      data: { isAdmin: body.isAdmin },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
