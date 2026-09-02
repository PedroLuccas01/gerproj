import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

const LOGIN_ALPHABET = "abcdefghijkmnopqrstuvwxyz23456789";
const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function randomFrom(alphabet: string, length: number) {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

export function generateShareToken() {
  return randomBytes(18).toString("base64url");
}

export function generateShareLogin() {
  return `cliente.${randomFrom(LOGIN_ALPHABET, 6)}`;
}

export function generateSharePassword() {
  return randomFrom(PASSWORD_ALPHABET, 10);
}

/** Válido até o fim do dia de término do projeto (Brasil, UTC−3). */
export function shareExpiresAtFromEndDate(endDate: Date) {
  const y = endDate.getUTCFullYear();
  const m = endDate.getUTCMonth();
  const d = endDate.getUTCDate();
  return new Date(Date.UTC(y, m, d + 1, 3, 0, 0, 0));
}

export function isShareActive(share: { revokedAt: Date | null; expiresAt: Date }, now = new Date()) {
  return !share.revokedAt && share.expiresAt.getTime() > now.getTime();
}

export async function findShareByToken(token: string) {
  return prisma.projectShare.findUnique({
    where: { token },
    include: { project: { select: { name: true } } },
  });
}

export async function findActiveShareForProject(projectId: string) {
  return prisma.projectShare.findFirst({
    where: { projectId, revokedAt: null },
    include: { project: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function revokeProjectShares(projectId: string) {
  await prisma.projectShare.updateMany({
    where: { projectId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function syncShareExpiry(projectId: string, endDate: Date) {
  const expiresAt = shareExpiresAtFromEndDate(endDate);
  await prisma.projectShare.updateMany({
    where: { projectId, revokedAt: null },
    data: { expiresAt },
  });
}

function utcDateIso(value: Date) {
  const y = value.getUTCFullYear();
  const m = String(value.getUTCMonth() + 1).padStart(2, "0");
  const d = String(value.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function toSharePublic(share: {
  token: string;
  login: string;
  expiresAt: Date;
  createdAt: Date;
  revokedAt: Date | null;
  project?: { endDate: Date };
}) {
  const expired = !isShareActive(share);
  return {
    token: share.token,
    login: share.login,
    expiresAt: share.expiresAt.toISOString(),
    validUntil: utcDateIso(share.project?.endDate ?? share.expiresAt),
    createdAt: share.createdAt.toISOString(),
    expired,
  };
}
