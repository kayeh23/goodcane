import type { DB } from "../types";

/**
 * Phase 3 will throw HTTP 409 when live litres for the batch meet the cap.
 * Phase 1 is a no-op so B/C can import this without waiting on capacity rules.
 */
export function assertBatchCapacity(_db: DB, _batchDate: string) {
  return;
}
