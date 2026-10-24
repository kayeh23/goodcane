import type { NextRequest } from "next/server";
import { body, handle } from "@/lib/api";
import { createOrder } from "@/lib/services/orders";

export async function POST(req: NextRequest) {
  const b = await body(req);
  return handle((db) => {
    const { order } = createOrder(db, b);
    return { id: order.id, code: order.code, status: order.status, batchDate: order.batchDate };
  });
}
