import type { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { decorate } from "@/lib/analytics";
import { nextBatch } from "@/lib/dates";
import { fmtPhone } from "@/lib/util";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  return handle((db) => {
    const B = nextBatch();
    const batch = sp.get("batch") || B;
    const status = sp.get("status") || "all";
    const source = sp.get("source") || "all";
    const batches = [...new Set([batch === "all" ? B : batch, B, ...db.orders.map((o) => o.batchDate)])].sort().reverse();
    const orders = db.orders
      .filter((o) => (batch === "all" || o.batchDate === batch) && (status === "all" || o.status === status) && (source === "all" || (source === "standing" ? !!o.standingOrderId : o.source === source)))
      .sort((a, b) => b.batchDate.localeCompare(a.batchDate) || b.createdAt.localeCompare(a.createdAt))
      .map((o) => decorate(db, o));
    const standing = db.standing.map((s) => {
      const c = db.customers.find((x) => x.id === s.customerId);
      return { ...s, customerName: c?.name, customerPhone: c ? fmtPhone(c.phone) : "", skippingNext: s.skipBatches.includes(B) };
    });
    return { batch, nextBatch: B, batches, orders, standing };
  }, { admin: req });
}
