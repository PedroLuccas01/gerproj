import { NextResponse } from "next/server";
import { requireManagement } from "@/lib/access";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { mapClient } from "@/lib/mappers";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/session";
import type { Client } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const access = await requireAccess();
    requireManagement(access);
    const { id } = await params;
    const patch = (await request.json()) as Partial<Client>;
    const existing = await prisma.client.findUnique({ where: { id } });
    if (!existing) return jsonError("Cliente não encontrado.", 404);
    const updated = await prisma.client.update({
      where: { id },
      data: {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.contact !== undefined ? { contact: patch.contact } : {}),
        ...(patch.email !== undefined ? { email: patch.email } : {}),
      },
    });
    return NextResponse.json(mapClient(updated));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const access = await requireAccess();
    requireManagement(access);
    const { id } = await params;
    await prisma.client.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
