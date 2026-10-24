import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth/staff";

export async function GET() {
  const session = await getStaffSession();
  const { username, role } = session;

  if (!username) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  return NextResponse.json({ username, role });
}
