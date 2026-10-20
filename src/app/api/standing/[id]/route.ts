import type { NextRequest } from "next/server";
import { body, handle } from "@/lib/api";
import { standingAction } from "@/lib/service";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const b = await body(req);
  return handle((db) => {
    const s = standingAction(db, id, b.phone, String(b.action ?? ""));
    return { id: s.id, status: s.status, skipBatches: s.skipBatches };
  });
}
