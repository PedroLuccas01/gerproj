import { NextResponse } from "next/server";
import { requireManagement } from "@/lib/access";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { mapClient } from "@/lib/mappers";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/session";
import type { ClientDraft } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const access = await requireAccess();
    requireManagement(access);
    const draft = (await request.json()) as ClientDraft;
    if (!draft?.name?.trim()) return jsonError("Nome do cliente é obrigatório.");
    const created = await prisma.client.create({
      data: {
        name: draft.name.trim(),
        contact: draft.contact ?? "",
        email: draft.email ?? "",
      },
    });
    return NextResponse.json(mapClient(created));
  } catch (error) {
    return handleApiError(error);
  }
}
