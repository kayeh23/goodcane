import { connection } from "next/server";
import { PICKUP_POINTS, pickupAvailable } from "@/lib/config";
import { cutoffFor, nextBatch } from "@/lib/dates";

export async function GET() {
  await connection();
  const now = new Date();
  const batchDate = nextBatch(now);
  return Response.json(
    {
      now: now.toISOString(),
      batchDate,
      cutoff: cutoffFor(batchDate).toISOString(),
      pickup: PICKUP_POINTS.map((p) => ({ id: p.id, available: pickupAvailable(p.id, batchDate) })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
