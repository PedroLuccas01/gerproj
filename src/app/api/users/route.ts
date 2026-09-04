import { NextResponse } from "next/server";
import { requireManagement } from "@/lib/access";
import { handleApiError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/session";
import { isSupportLogin } from "@/lib/support-admin";

export async function GET() {
  try {
    const access = await requireAccess();
    requireManagement(access);
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        isAdmin: true,
        createdAt: true,
      },
    });
    return NextResponse.json({
      users: users
        .filter((user) => !isSupportLogin(user.email))
        .map((user) => ({
        ...user,
        createdAt: user.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
