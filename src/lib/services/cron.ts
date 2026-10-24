import type { DB } from "../types";
import { sync } from "./batch";

/** Phase 3 wires this to `/api/cron/sync`. Phase 1 is the same as request-time `sync`. */
export function runScheduledSync(db: DB, now = new Date(), sample = false) {
  return sync(db, now, sample);
}
