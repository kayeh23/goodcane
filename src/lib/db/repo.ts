/**
 * Repository boundary for orders and the JSON document.
 *
 * Phase 1 wraps the in-memory / Upstash store. Postgres (Drizzle) lands in
 * Phase 2 behind this same module so B and C keep importing from `@/lib/db`.
 */
import type { DB, Order } from "../types";
import { mutate as storeMutate, resetStore, store } from "../store";

export { store, resetStore };

export const mutate = storeMutate;

export async function readDb(): Promise<DB> {
  return store.read();
}

export async function getOrder(id: string): Promise<Order | undefined> {
  const db = await store.read();
  return db.orders.find((o) => o.id === id);
}

export async function listBatchOrders(batchDate: string): Promise<Order[]> {
  const db = await store.read();
  return db.orders.filter((o) => o.batchDate === batchDate);
}
