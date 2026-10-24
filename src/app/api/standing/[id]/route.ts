import type { NextRequest } from "next/server";
import { requireCustomer, body, handle } from "@/lib/api";
import { standingAction } from "@/lib/services/orders";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const phone = await requireCustomer(req);
  if (phone instanceof Response) return phone;
  const { id } = await ctx.params;
  const b = await body(req);
  return handle((db) => {
    const s = standingAction(db, id, phone, String(b.action ?? ""));
    return { id: s.id, status: s.status, skipBatches: s.skipBatches };
  });
}
