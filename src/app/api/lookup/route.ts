import type { NextRequest } from "next/server";
import { body, handle } from "@/lib/api";
import { decorate } from "@/lib/analytics";
import { lookup } from "@/lib/service";

/** Phone lookup (POST so the number isn't in URLs/logs). Prototype only: a pilot should add an SMS one-time code. */
export async function POST(req: NextRequest) {
  const b = await body(req);
  return handle((db) => {
    const r = lookup(db, b.phone);
    return { ...r, orders: r.orders.map((o) => { const d = decorate(db, o); return { id: o.id, code: o.code, status: o.status, batchDate: o.batchDate, items: o.items, total: d.total, fulfilmentLabel: d.fulfilmentLabel, fulfilment: o.fulfilment, source: o.source, standingOrderId: o.standingOrderId, cancelReason: o.cancelReason }; }) };
  });
}
