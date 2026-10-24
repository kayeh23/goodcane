import { NextResponse } from "next/server";

/** The demo passcode no longer opens the desk. Staff use POST /api/auth/login. */
export async function POST() {
  return NextResponse.json({ error: "Staff sign-in is POST /api/auth/login." }, { status: 410 });
}
