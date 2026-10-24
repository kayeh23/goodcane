/**
 * Repository boundary for orders and the domain document.
 *
 * If DATABASE_URL is set, reads/writes Postgres (Drizzle). Otherwise the
 * in-memory / Upstash JSON store is used so B and C are not blocked.
 */
import type { DB, Order } from "../types";
import { mutate as storeMutate, resetStore as resetJsonStore, store as jsonStore } from "../store";
import { usingPostgres } from "./client";
import {
  fetchBatchOrders,
  fetchOrder,
  fetchStaffByUsername,
  insertOrder,
  loadDocument,
  resetDocument,
  saveDocument,
  type StaffUser,
} from "./postgres";

export type { StaffUser };

const g = globalThis as unknown as { __goodcanePgLock?: Promise<unknown> };

export const store = {
  get kind() {
    return usingPostgres() ? "postgres" : jsonStore.kind;
  },
};

async function withPgLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = g.__goodcanePgLock ?? Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((r) => (release = r));
  g.__goodcanePgLock = prev.then(() => next);
  await prev.catch(() => {});
  try {
    return await fn();
  } finally {
    release();
  }
}

export async function mutate<T>(fn: (db: DB) => T | Promise<T>): Promise<T> {
  if (!usingPostgres()) return storeMutate(fn);
  return withPgLock(async () => {
    const db = structuredClone(await loadDocument());
    const out = await fn(db);
    await saveDocument(db);
    return out;
  });
}

export async function readDb(): Promise<DB> {
  if (!usingPostgres()) return jsonStore.read();
  return loadDocument();
}

export async function getOrder(id: string): Promise<Order | undefined> {
  if (usingPostgres()) return fetchOrder(id);
  const db = await jsonStore.read();
  return db.orders.find((o) => o.id === id);
}

export async function listBatchOrders(batchDate: string): Promise<Order[]> {
  if (usingPostgres()) return fetchBatchOrders(batchDate);
  const db = await jsonStore.read();
  return db.orders.filter((o) => o.batchDate === batchDate);
}

/** Inserts an already-built order row. Domain `createOrder` in services/orders.ts is the public writer. */
export async function createOrder(order: Order): Promise<Order> {
  if (usingPostgres()) return insertOrder(order);
  return storeMutate((db) => {
    db.orders.push(order);
    return order;
  });
}

export async function getStaffByUsername(username: string): Promise<StaffUser | undefined> {
  if (!usingPostgres()) return undefined;
  return fetchStaffByUsername(username);
}

export async function resetStore(): Promise<DB> {
  if (usingPostgres()) return resetDocument();
  return resetJsonStore();
}
