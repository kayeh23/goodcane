import type { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { metrics } from "@/lib/analytics";

export async function GET(req: NextRequest) {
  return handle((db) => metrics(db), { admin: req });
}
