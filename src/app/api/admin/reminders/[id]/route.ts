import type { NextRequest } from "next/server";
import { body, handle } from "@/lib/api";
import { reminderAction } from "@/lib/service";

/** Approve = mark "sent (simulated)". This prototype never sends SMS/WhatsApp. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const b = await body(req);
  return handle((db) => {
    const r = reminderAction(db, id, String(b.action ?? ""));
    return { id: r.id, status: r.status };
  }, { admin: req });
}
