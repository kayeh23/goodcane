import type { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { decorate } from "@/lib/analytics";
import { AppError } from "@/lib/errors";

/** Public order status. Order ids are unguessable; only first name is returned. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle((db) => {
    const o = db.orders.find((x) => x.id === id);
    if (!o) throw new AppError("Order not found.", 404);
    const d = decorate(db, o);
    const s = o.standingOrderId ? db.standing.find((x) => x.id === o.standingOrderId) : undefined;
    return {
      id: o.id, code: o.code, status: o.status, batchDate: o.batchDate, items: o.items, total: d.total,
      fulfilmentLabel: d.fulfilmentLabel, events: o.events, cancelReason: o.cancelReason, source: o.source,
      firstName: d.customerName, remindersOptIn: d.remindersOptIn, standing: s ? { status: s.status } : null, sample: o.sample,
    };
  });
}
