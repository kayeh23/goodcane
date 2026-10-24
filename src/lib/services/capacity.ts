import { AppError } from "../errors";
import type { DB, LineItem } from "../types";
import { isLive, litresOf } from "../util";

/**
 * ASSUMPTION — to confirm with GoodCane.
 * Kept here (not config.ts) so Person B's catalogue file stays unconflicted.
 */
export const BATCH_CAPACITY_LITRES = 150;

export function liveBatchLitres(db: DB, batchDate: string): number {
  let litres = 0;
  for (const o of db.orders) {
    if (o.batchDate !== batchDate || !isLive(o)) continue;
    litres += litresOf(o.items);
  }
  return litres;
}

export function wouldExceedCapacity(db: DB, batchDate: string, extraLitres = 0): boolean {
  return liveBatchLitres(db, batchDate) + extraLitres >= BATCH_CAPACITY_LITRES;
}

/** Throws HTTP 409 when this batch cannot take `extra` litres (or is already full). */
export function assertBatchCapacity(db: DB, batchDate: string, extra: LineItem[] | number = 0) {
  const extraLitres = typeof extra === "number" ? extra : litresOf(extra);
  if (wouldExceedCapacity(db, batchDate, extraLitres)) {
    throw new AppError("Batch is at full capacity", 409);
  }
}
