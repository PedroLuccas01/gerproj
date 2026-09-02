import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth-types";

const SESSION_SECRET = process.env.AUTH_SECRET
  ? new TextEncoder().encode(process.env.AUTH_SECRET)
  : null;

async function hasSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !SESSION_SECRET) return false;
  try {
    const { jwtVerify } = await import("jose");
    await jwtVerify(token, SESSION_SECRET);
    return true;
  } catch {
    return false;
  }
}

function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

function isPublicSharePath(pathname: string) {
  return pathname.startsWith("/c/");
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isLogin = pathname === "/login";
  const isShare = isPublicSharePath(pathname);

  if (isShare) {
    return NextResponse.next();
  }

  if (isLogin && request.nextUrl.searchParams.get("session") === "end") {
    const url = request.nextUrl.clone();
    url.searchParams.delete("session");
    const response = NextResponse.redirect(url);
    clearSessionCookie(response);
    return response;
  }

  if (isLogin && !request.cookies.get(SESSION_COOKIE)?.value) {
    return NextResponse.next();
  }

  const loggedIn = await hasSession(request);

  if (!loggedIn && !isLogin) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (loggedIn && isLogin) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|ico|svg|jpg|jpeg|gif|webp)$).*)",
  ],
};
