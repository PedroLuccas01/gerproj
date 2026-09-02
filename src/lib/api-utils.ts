import { NextResponse } from "next/server";
import { isPrismaCode } from "@/lib/prisma";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function handleApiError(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHENTICATED") {
    return jsonError("Não autenticado.", 401);
  }
  if (error instanceof Error && error.message === "FORBIDDEN") {
    return jsonError("Sem permissão.", 403);
  }
  if (error instanceof Error && error.message === "NOT_FOUND") {
    return jsonError("Não encontrado.", 404);
  }
  if (isPrismaCode(error, "P2024") || isPrismaCode(error, "P1017") || isPrismaCode(error, "P1001")) {
    return jsonError("O servidor está ocupado. Tente de novo em instantes.", 503);
  }
  console.error(error);
  return jsonError("Erro interno.", 500);
}
