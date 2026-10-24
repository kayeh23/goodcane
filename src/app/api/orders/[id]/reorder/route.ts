import type { NextRequest } from "next/server";
import { requireCustomer, handle } from "@/lib/api";
import { reorder } from "@/lib/services/orders";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const phone = await requireCustomer(req);
  if (phone instanceof Response) return phone;
  const { id } = await ctx.params;
  return handle((db) => {
    const { order } = reorder(db, id, phone);
    return { id: order.id, code: order.code, status: order.status, batchDate: order.batchDate };
  });
}
