import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { SHARE_COOKIE } from "@/lib/auth-types";
import { findShareByToken, isShareActive } from "@/lib/project-share";

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET não configurado");
  return new TextEncoder().encode(value);
}

export async function createShareSession(input: {
  shareId: string;
  token: string;
  projectId: string;
  expiresAt: Date;
}) {
  const token = await new SignJWT({ shareToken: input.token, projectId: input.projectId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(input.shareId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(input.expiresAt.getTime() / 1000))
    .sign(secret());

  const jar = await cookies();
  jar.set(SHARE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function clearShareSession() {
  const jar = await cookies();
  jar.set(SHARE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getShareSession(): Promise<{ shareId: string; token: string; projectId: string } | null> {
  const jar = await cookies();
  const token = jar.get(SHARE_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (
      !payload.sub ||
      typeof payload.shareToken !== "string" ||
      typeof payload.projectId !== "string"
    ) {
      return null;
    }
    return { shareId: payload.sub, token: payload.shareToken, projectId: payload.projectId };
  } catch {
    return null;
  }
}

export async function requireShareAccess(token: string) {
  const session = await getShareSession();
  if (!session || session.token !== token) {
    const error = new Error("UNAUTHENTICATED");
    throw error;
  }
  const share = await findShareByToken(token);
  if (!share || share.id !== session.shareId || !isShareActive(share)) {
    await clearShareSession();
    const error = new Error("UNAUTHENTICATED");
    throw error;
  }
  return share;
}
