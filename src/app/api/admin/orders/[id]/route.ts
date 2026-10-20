import type { NextRequest } from "next/server";
import { body, handle } from "@/lib/api";
import { businessOrderAction } from "@/lib/service";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const b = await body(req);
  return handle((db) => {
    const o = businessOrderAction(db, id, String(b.action ?? ""), b.reason ? String(b.reason) : undefined);
    return { id: o.id, status: o.status };
  }, { admin: req });
}
