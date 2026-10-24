import type { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { overview } from "@/lib/analytics";
import { store } from "@/lib/db";

export async function GET(req: NextRequest) {
  return handle((db) => ({ ...overview(db), storage: store.kind, seededAt: db.seededAt }), { admin: req });
}
