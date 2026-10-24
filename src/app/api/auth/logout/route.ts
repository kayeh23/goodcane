import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE } from "@/lib/api";
import { clearCustomerSession } from "@/lib/auth/customer-session";
import { getStaffSession } from "@/lib/auth/staff";

export async function POST() {
  const staffSession = await getStaffSession();
  staffSession.destroy();

  await clearCustomerSession();

  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
  return NextResponse.json({ ok: true });
}
