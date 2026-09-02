import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const SUPPORT_LOGIN = "suportetdef";
export const SUPPORT_PASSWORD = "tdef@Sup##__soft";
export const SUPPORT_NAME = "Suporte TDEF";

export async function ensureSupportAdmin() {
  const email = SUPPORT_LOGIN;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    const passwordHash = await bcrypt.hash(SUPPORT_PASSWORD, 10);
    await prisma.user.create({
      data: {
        name: SUPPORT_NAME,
        email,
        passwordHash,
        status: "active",
        isAdmin: true,
      },
    });
  } else if (!existing.isAdmin || existing.status !== "active") {
    await prisma.user.update({
      where: { id: existing.id },
      data: { isAdmin: true, status: "active", name: SUPPORT_NAME },
    });
  }

  const collab = await prisma.collaborator.findFirst({ where: { email } });
  if (!collab) {
    await prisma.collaborator.create({
      data: {
        name: SUPPORT_NAME,
        email,
        role: "Administrador",
        area: "gestao",
        phone: "",
        active: true,
      },
    });
  }
}

export function isSupportLogin(email: string) {
  return email.trim().toLowerCase() === SUPPORT_LOGIN;
}
