import type { NextRequest } from "next/server";
import { requireCustomer } from "@/lib/api";
import { handle } from "@/lib/api";
import { decorate } from "@/lib/analytics";
import { lookup } from "@/lib/services/customer";

/** Phone lookup. Requires the OTP-verified customer session; the request body is ignored. */
export async function POST(req: NextRequest) {
  const phone = await requireCustomer(req);
  if (phone instanceof Response) return phone;
  return handle((db) => {
    const r = lookup(db, phone);
    return { ...r, orders: r.orders.map((o) => { const d = decorate(db, o); return { id: o.id, code: o.code, status: o.status, batchDate: o.batchDate, items: o.items, total: d.total, fulfilmentLabel: d.fulfilmentLabel, fulfilment: o.fulfilment, source: o.source, standingOrderId: o.standingOrderId, cancelReason: o.cancelReason }; }) };
  });
}
