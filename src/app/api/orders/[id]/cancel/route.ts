import type { NextRequest } from "next/server";
import { body, handle } from "@/lib/api";
import { customerCancel } from "@/lib/service";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const b = await body(req);
  return handle((db) => {
    const o = customerCancel(db, id, b.phone);
    return { id: o.id, status: o.status };
  });
}
