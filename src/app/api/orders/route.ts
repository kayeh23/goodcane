import type { NextRequest } from "next/server";
import { requireCustomer, body, handle } from "@/lib/api";
import { createOrder } from "@/lib/services/orders";

export async function POST(req: NextRequest) {
  const phone = await requireCustomer(req);
  if (phone instanceof Response) return phone;
  const b = await body(req);
  return handle((db) => {
    const { order } = createOrder(db, { ...b, phone, source: "web" });
    return { id: order.id, code: order.code, status: order.status, batchDate: order.batchDate };
  });
}
