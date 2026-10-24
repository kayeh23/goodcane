import { attachDatabasePool } from "@vercel/functions";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

const g = globalThis as unknown as { __goodcanePg?: Pool; __goodcaneDrizzle?: Database };

export function databaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL?.trim();
  return url || undefined;
}

export function usingPostgres(): boolean {
  return Boolean(databaseUrl());
}

function getPool(): Pool {
  if (!g.__goodcanePg) {
    const url = databaseUrl();
    if (!url) throw new Error("DATABASE_URL is not set.");
    const pool = new Pool({
      connectionString: url,
      max: 5,
      idleTimeoutMillis: 10_000,
    });
    attachDatabasePool(pool);
    g.__goodcanePg = pool;
  }
  return g.__goodcanePg;
}

export function getDrizzle(): Database {
  if (!g.__goodcaneDrizzle) g.__goodcaneDrizzle = drizzle(getPool(), { schema });
  return g.__goodcaneDrizzle;
}
