import { cutoffFor } from "../dates";
import type { DB } from "../types";
import { sync } from "./batch";
import { pushEvent } from "./orders";

const CUTOFF_REASON = "Unconfirmed at cutoff";

/** Cancels leftover `requested` orders whose batch cutoff has passed. */
export function cancelUnconfirmedAtCutoff(db: DB, now = new Date()): number {
  let n = 0;
  for (const o of db.orders) {
    if (o.status !== "requested") continue;
    if (cutoffFor(o.batchDate).getTime() > now.getTime()) continue;
    o.status = "cancelled";
    o.cancelledBy = "business";
    o.cancelReason = CUTOFF_REASON;
    pushEvent(o, "cancelled", "system", CUTOFF_REASON, now);
    n += 1;
  }
  return n;
}

/**
 * Hourly worker: close unconfirmed requests past cutoff, then the usual
 * standing-order / reminder / forecast sync for the next open batch.
 */
export function runScheduledSync(db: DB, now = new Date(), sample = false) {
  const cancelled = cancelUnconfirmedAtCutoff(db, now);
  const batchDate = sync(db, now, sample);
  return { batchDate, cancelled };
}
