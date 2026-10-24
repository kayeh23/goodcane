import { NextResponse, type NextRequest } from "next/server";
import { isAdmin } from "@/lib/api";
import { resetStore } from "@/lib/db";

export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: "Staff sign-in required." }, { status: 401 });
  const db = await resetStore();
  return NextResponse.json({ ok: true, orders: db.orders.length });
}
