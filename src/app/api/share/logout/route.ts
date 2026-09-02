import { NextResponse } from "next/server";
import { clearShareSession } from "@/lib/share-session";

export async function POST() {
  await clearShareSession();
  return NextResponse.json({ ok: true });
}
