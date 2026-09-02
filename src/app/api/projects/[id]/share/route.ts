import { NextResponse } from "next/server";
import { requireManagement } from "@/lib/access";
import { handleApiError } from "@/lib/api-utils";
import {
  findActiveShareForProject,
  generateShareLogin,
  generateSharePassword,
  generateShareToken,
  revokeProjectShares,
  shareExpiresAtFromEndDate,
  toSharePublic,
} from "@/lib/project-share";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/session";
import bcrypt from "bcryptjs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const access = await requireAccess();
    requireManagement(access);
    const { id } = await params;
    const share = await findActiveShareForProject(id);
    return NextResponse.json({ share: share ? toSharePublic(share) : null });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(_request: Request, { params }: Params) {
  try {
    const access = await requireAccess();
    requireManagement(access);
    const { id } = await params;
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      const error = new Error("NOT_FOUND");
      throw error;
    }

    const expiresAt = shareExpiresAtFromEndDate(project.endDate);
    if (expiresAt.getTime() <= Date.now()) {
      return NextResponse.json(
        { error: "O prazo do projeto já encerrou. Ajuste a data de término para gerar um link." },
        { status: 400 },
      );
    }

    const login = generateShareLogin();
    const password = generateSharePassword();
    const token = generateShareToken();

    await revokeProjectShares(id);
    const share = await prisma.projectShare.create({
      data: {
        projectId: id,
        token,
        login,
        passwordHash: await bcrypt.hash(password, 10),
        expiresAt,
      },
      include: { project: true },
    });

    return NextResponse.json({
      share: toSharePublic(share),
      password,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const access = await requireAccess();
    requireManagement(access);
    const { id } = await params;
    await revokeProjectShares(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
