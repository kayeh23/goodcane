import type { NextRequest } from "next/server";
import { body, handle } from "@/lib/api";
import { reorder } from "@/lib/services/orders";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const b = await body(req);
  return handle((db) => {
    const { order } = reorder(db, id, b.phone);
    return { id: order.id, code: order.code, status: order.status, batchDate: order.batchDate };
  });
}
