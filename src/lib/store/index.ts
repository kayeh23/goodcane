/**
 * Storage layer — the ONLY module that knows where data lives.
 *
 * Default: in-memory store, seeded with labelled SAMPLE data on cold start.
 *   + zero setup, works on Vercel free tier
 *   - data resets when the server instance restarts, and separate serverless
 *     instances may each hold their own copy (fine for a demo, not for a pilot)
 *
 * Optional: set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (or the
 * Vercel KV equivalents KV_REST_API_URL + KV_REST_API_TOKEN) to persist the
 * same JSON document in Upstash Redis. For a real pilot, swap this module for
 * Postgres tables with the same read/write contract.
 */
import type { DB } from "../types";
import { buildSeed } from "../seed";

export interface DataStore {
  kind: string;
  read(): Promise<DB>;
  write(db: DB): Promise<void>;
}

const g = globalThis as unknown as { __goodcaneDb?: DB; __goodcaneLock?: Promise<unknown> };

const memoryStore: DataStore = {
  kind: "memory",
  async read() {
    if (!g.__goodcaneDb) g.__goodcaneDb = buildSeed(new Date());
    return g.__goodcaneDb;
  },
  async write(db) {
    g.__goodcaneDb = db;
  },
};

function upstashStore(url: string, token: string): DataStore {
  const key = process.env.GOODCANE_DB_KEY || "goodcane:demo-db";
  const call = async (cmd: unknown[]) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(cmd),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Upstash error ${res.status}`);
    return (await res.json()) as { result: unknown };
  };
  return {
    kind: "upstash",
    async read() {
      const { result } = await call(["GET", key]);
      if (typeof result === "string") return JSON.parse(result) as DB;
      const seeded = buildSeed(new Date());
      await call(["SET", key, JSON.stringify(seeded)]);
      return seeded;
    },
    async write(db) {
      await call(["SET", key, JSON.stringify(db)]);
    },
  };
}

function pickStore(): DataStore {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? upstashStore(url, token) : memoryStore;
}

export const store = pickStore();

/** Serialise read-modify-write cycles within one server instance. */
export async function mutate<T>(fn: (db: DB) => T | Promise<T>): Promise<T> {
  const prev = g.__goodcaneLock ?? Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((r) => (release = r));
  g.__goodcaneLock = prev.then(() => next);
  await prev.catch(() => {});
  try {
    const db = structuredClone(await store.read());
    const out = await fn(db);
    await store.write(db);
    return out;
  } finally {
    release();
  }
}

export async function resetStore() {
  const db = buildSeed(new Date());
  await store.write(db);
  return db;
}
