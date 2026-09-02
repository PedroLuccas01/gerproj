import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { toAuthUser } from "@/lib/access";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";
import { ensureSupportAdmin } from "@/lib/support-admin";

export async function POST(request: Request) {
  try {
    await ensureSupportAdmin();
    const body = (await request.json()) as { email?: string; password?: string };
    const email = body.email?.trim().toLowerCase() ?? "";
    const password = body.password ?? "";
    if (!email || !password) return jsonError("Informe e-mail e senha.");

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return jsonError("E-mail ou senha inválidos.", 401);
    }
    if (user.status === "rejected") {
      return jsonError("Seu cadastro não foi aprovado.", 403);
    }

    const session = { id: user.id, name: user.name, email: user.email };
    await createSession(session);
    return NextResponse.json({ user: await toAuthUser(session) });
  } catch (error) {
    return handleApiError(error);
  }
}
