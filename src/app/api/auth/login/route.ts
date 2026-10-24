import { NextResponse, type NextRequest } from "next/server";
import { body } from "@/lib/api";
import { getStaffSession, verifyStaff } from "@/lib/auth/staff";

export async function POST(req: NextRequest) {
  const b = await body(req);
  const username = typeof b.username === "string" ? b.username.trim() : "";
  const password = typeof b.password === "string" ? b.password : "";

  if (!username || !password) {
    return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
  }

  // Generic message on purpose: never reveal whether the username or
  // the password was the wrong part.
  const staff = await verifyStaff(username, password);
  if (!staff) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const session = await getStaffSession();
  session.username = staff.username;
  session.role = staff.role;
  await session.save();

  return NextResponse.json({ ok: true });
}
