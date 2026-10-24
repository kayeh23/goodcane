import type { NextRequest } from "next/server";
import { requireCustomer, handle } from "@/lib/api";
import { customerCancel } from "@/lib/services/orders";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const phone = await requireCustomer(req);
  if (phone instanceof Response) return phone;
  const { id } = await ctx.params;
  return handle((db) => {
    const o = customerCancel(db, id, phone);
    return { id: o.id, status: o.status };
  });
}
