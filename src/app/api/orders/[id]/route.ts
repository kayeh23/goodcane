import type { NextRequest } from "next/server";
import { requireCustomer, handle } from "@/lib/api";
import { decorate } from "@/lib/analytics";
import { getOrderForPhone } from "@/lib/services/orders";

/** Order status. Only verified owners may view the order via their session; others get 401. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const phone = await requireCustomer(req);
  if (phone instanceof Response) return phone;
  const { id } = await ctx.params;
  return handle((db) => {
    const o = getOrderForPhone(db, id, phone);
    const d = decorate(db, o);
    const s = o.standingOrderId ? db.standing.find((x) => x.id === o.standingOrderId) : undefined;
    return {
      id: o.id, code: o.code, status: o.status, batchDate: o.batchDate, items: o.items, total: d.total,
      fulfilmentLabel: d.fulfilmentLabel, events: o.events, cancelReason: o.cancelReason, source: o.source,
      firstName: d.customerName, remindersOptIn: d.remindersOptIn, standing: s ? { status: s.status } : null, sample: o.sample,
    };
  });
}
