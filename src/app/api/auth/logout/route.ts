import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth/staff";

export async function POST() {
  const session = await getStaffSession();
  session.destroy();
  return NextResponse.json({ ok: true });
}
