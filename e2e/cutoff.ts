import { cutoffFor } from "@/lib/dates";
import { cancelUnconfirmedAtCutoff, runScheduledSync } from "@/lib/services/cron";
import type { DB, Order } from "@/lib/types";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
  console.log(`[PASS] ${message}`);
}

function order(partial: Partial<Order> & Pick<Order, "id" | "code" | "status" | "batchDate">): Order {
  return {
    customerId: "c_cutoff",
    items: [{ productId: "raw", sizeId: "330ml", qty: 1, unitPrice: 35 }],
    fulfilment: { type: "pickup", pointId: "adenta" },
    source: "web",
    createdAt: "2026-10-20T10:00:00.000Z",
    events: [],
    sample: true,
    ...partial,
  };
}

function emptyDb(orders: Order[]): DB {
  return {
    version: 1,
    seededAt: "2026-10-20T10:00:00.000Z",
    customers: [
      {
        id: "c_cutoff",
        name: "Cutoff Test",
        phone: "0245550100",
        remindersOptIn: false,
        createdAt: "2026-10-20T10:00:00.000Z",
        sample: true,
      },
    ],
    orders,
    standing: [],
    reminders: [],
    forecasts: [],
  };
}

function runCutoffTests() {
  console.log("=== Cutoff auto-cancel simulation ===\n");

  const batchDate = "2026-10-31";
  const cutoff = cutoffFor(batchDate);
  assert(cutoff.toISOString() === "2026-10-29T18:00:00.000Z", "Saturday 31 Oct batch cuts off Thu 29 Oct 18:00 UTC");

  const requested = order({ id: "o_req", code: "GC-1001", status: "requested", batchDate });
  const confirmed = order({ id: "o_conf", code: "GC-1002", status: "confirmed", batchDate });
  const paid = order({ id: "o_paid", code: "GC-1003", status: "paid", batchDate });
  const later = order({ id: "o_next", code: "GC-1004", status: "requested", batchDate: "2026-11-07" });

  console.log("Test 1: Before cutoff, requested orders stay open");
  const before = emptyDb([structuredClone(requested)]);
  const nBefore = cancelUnconfirmedAtCutoff(before, new Date("2026-10-29T17:59:00.000Z"));
  assert(nBefore === 0, "No cancellations before cutoff");
  assert(before.orders[0].status === "requested", "Requested order still requested before cutoff");

  console.log("\nTest 2: At cutoff, unconfirmed requests cancel; firm orders stay");
  const atCutoff = emptyDb([
    structuredClone(requested),
    structuredClone(confirmed),
    structuredClone(paid),
    structuredClone(later),
  ]);
  const nAt = cancelUnconfirmedAtCutoff(atCutoff, new Date("2026-10-29T18:00:00.000Z"));
  assert(nAt === 1, "Exactly one unconfirmed order cancelled at cutoff");
  assert(atCutoff.orders[0].status === "cancelled", "Requested order cancelled at cutoff");
  assert(atCutoff.orders[0].cancelReason === "Unconfirmed at cutoff", "Cancel reason is Unconfirmed at cutoff");
  assert(atCutoff.orders[0].cancelledBy === "business", "Cancelled by business/system");
  assert(atCutoff.orders[1].status === "confirmed", "Confirmed order not cancelled");
  assert(atCutoff.orders[2].status === "paid", "Paid order not cancelled");
  assert(atCutoff.orders[3].status === "requested", "Next week's request not cancelled");

  console.log("\nTest 3: runScheduledSync after cutoff reports cancelled count");
  const synced = emptyDb([structuredClone(requested)]);
  const result = runScheduledSync(synced, new Date("2026-10-30T12:00:00.000Z"));
  assert(result.cancelled === 1, "Scheduled sync cancelled the leftover request");
  assert(synced.orders[0].status === "cancelled", "Order is cancelled after scheduled sync");

  console.log("\nAll cutoff simulation tests passed.");
}

runCutoffTests();
