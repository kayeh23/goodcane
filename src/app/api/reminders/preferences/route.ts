import type { NextRequest } from "next/server";
import { body, handle } from "@/lib/api";
import { setReminders } from "@/lib/service";

export async function POST(req: NextRequest) {
  const b = await body(req);
  return handle((db) => ({ remindersOptIn: setReminders(db, b.phone, b.optIn === true).remindersOptIn }));
}
