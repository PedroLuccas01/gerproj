import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { toAuthUser } from "@/lib/access";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";
import { isSupportLogin } from "@/lib/support-admin";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      email?: string;
      password?: string;
    };
    const name = body.name?.trim() ?? "";
    const email = body.email?.trim().toLowerCase() ?? "";
    const password = body.password ?? "";

    if (name.length < 3) return jsonError("Informe o nome completo.");
    if (!email) return jsonError("Informe o e-mail.");
    if (password.length < 6) return jsonError("A senha deve ter pelo menos 6 caracteres.");
    if (isSupportLogin(email)) return jsonError("Este usuário não pode ser cadastrado.");

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return jsonError("Já existe uma conta com este e-mail.");

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        status: "pending",
        isAdmin: false,
      },
    });

    const session = { id: user.id, name: user.name, email: user.email };
    await createSession(session);
    return NextResponse.json({ user: await toAuthUser(session) });
  } catch (error) {
    return handleApiError(error);
  }
}
