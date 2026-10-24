import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE } from "@/lib/api";
import { getStaffSession } from "@/lib/auth/staff";

export async function POST() {
  const session = await getStaffSession();
  session.destroy();
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
  return NextResponse.json({ ok: true });
}
