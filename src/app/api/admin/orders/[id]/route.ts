import type { NextRequest } from "next/server";
import { body, handle } from "@/lib/api";
import { businessOrderAction } from "@/lib/services/orders";
import { markPaid } from "@/lib/services/payments";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const b = await body(req);
  return handle((db) => {
    const action = String(b.action ?? "");
    const o = action === "pay" ? markPaid(db, id) : businessOrderAction(db, id, action, b.reason ? String(b.reason) : undefined);
    return { id: o.id, status: o.status };
  }, { admin: req });
}
