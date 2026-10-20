import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, adminToken, body } from "@/lib/api";
import { DEMO_PASSCODE } from "@/lib/config";

export async function POST(req: NextRequest) {
  const b = await body(req);
  if (String(b.passcode ?? "").trim() !== DEMO_PASSCODE) return NextResponse.json({ error: "Wrong passcode." }, { status: 401 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, adminToken(), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 12, secure: process.env.NODE_ENV === "production" });
  return res;
}
