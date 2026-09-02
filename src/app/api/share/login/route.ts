import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { findShareByToken, isShareActive } from "@/lib/project-share";
import { withDbRetry } from "@/lib/prisma";
import { createShareSession } from "@/lib/share-session";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { token?: string; login?: string; password?: string };
    const token = body.token?.trim() ?? "";
    const login = body.login?.trim() ?? "";
    const password = body.password ?? "";
    if (!token || !login || !password) return jsonError("Informe login e senha.");

    const share = await withDbRetry(() => findShareByToken(token));
    if (!share || share.revokedAt) {
      return jsonError("Este link não está mais disponível.", 404);
    }
    if (!isShareActive(share)) {
      return jsonError("Este acesso expirou.", 403);
    }
    if (share.login !== login || !(await bcrypt.compare(password, share.passwordHash))) {
      return jsonError("Login ou senha inválidos.", 401);
    }

    await createShareSession({
      shareId: share.id,
      token: share.token,
      projectId: share.projectId,
      expiresAt: share.expiresAt,
    });
    return NextResponse.json({ ok: true, projectName: share.project.name });
  } catch (error) {
    return handleApiError(error);
  }
}
