import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { DEMO_PASSCODE } from "./config";
import { mutate } from "./db";
import { AppError } from "./errors";
import { sync } from "./services/batch";
import type { DB } from "./types";

export const ADMIN_COOKIE = "gc_admin";
export const adminToken = () => createHash("sha256").update(`goodcane-demo:${DEMO_PASSCODE}`).digest("hex");

export function isAdmin(req: NextRequest) {
  return req.cookies.get(ADMIN_COOKIE)?.value === adminToken();
}

export async function body(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    const b = await req.json();
    return b && typeof b === "object" ? b : {};
  } catch {
    return {};
  }
}

/** Run fn against the synced DB inside the write lock, map errors to JSON. */
export async function handle<T>(fn: (db: DB) => T | Promise<T>, opts: { admin?: NextRequest } = {}) {
  if (opts.admin && !isAdmin(opts.admin)) return NextResponse.json({ error: "Business passcode required." }, { status: 401 });
  try {
    const out = await mutate(async (db) => {
      sync(db);
      return fn(db);
    });
    return out instanceof Response ? out : NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof AppError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
