import type { NextRequest } from "next/server";
import { requireCustomer, body, handle } from "@/lib/api";
import { setReminders } from "@/lib/services/customer";

export async function POST(req: NextRequest) {
  const phone = await requireCustomer(req);
  if (phone instanceof Response) return phone;
  const b = await body(req);
  return handle((db) => ({ remindersOptIn: setReminders(db, phone, b.optIn === true).remindersOptIn }));
}
