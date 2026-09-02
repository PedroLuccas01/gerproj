import { NextResponse } from "next/server";
import { toAuthUser } from "@/lib/access";
import { getSessionUser } from "@/lib/session";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({ user: await toAuthUser(user) });
}
