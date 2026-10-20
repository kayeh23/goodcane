import type { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { fmtPhone } from "@/lib/util";

export async function GET(req: NextRequest) {
  return handle((db) => ({
    reminders: [...db.reminders]
      .sort((a, b) => (a.status === "pending" ? 0 : 1) - (b.status === "pending" ? 0 : 1) || b.batchDate.localeCompare(a.batchDate))
      .slice(0, 60)
      .map((r) => {
        const c = db.customers.find((x) => x.id === r.customerId);
        return { ...r, customerName: c?.name, customerPhone: c ? fmtPhone(c.phone) : "", optedIn: c?.remindersOptIn ?? false };
      }),
  }), { admin: req });
}
