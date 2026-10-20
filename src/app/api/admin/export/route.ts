import type { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { batchCsv } from "@/lib/analytics";
import { nextBatch } from "@/lib/dates";

export async function GET(req: NextRequest) {
  const batch = req.nextUrl.searchParams.get("batch") || nextBatch();
  return handle(
    (db) =>
      new Response(batchCsv(db, batch), {
        headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="goodcane-batch-${batch}-SAMPLE.csv"`, "Cache-Control": "no-store" },
      }),
    { admin: req },
  );
}
