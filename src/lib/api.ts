import { NextResponse, type NextRequest } from "next/server";
import { getStaffSession } from "./auth/staff";
import { getCustomerSession } from "./auth/customer-session";
import { mutate } from "./db";
import { AppError } from "./errors";
import { sync } from "./services/batch";
import type { DB } from "./types";

/** Legacy demo cookie. Logout still clears it. It does not authorize /api/admin. */
export const ADMIN_COOKIE = "gc_admin";

export async function isAdmin(_req: NextRequest) {
  const session = await getStaffSession();
  return Boolean(session.username);
}

export async function body(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    const b = await req.json();
    return b && typeof b === "object" ? b : {};
  } catch {
    return {};
  }
}

/** Return the verified customer phone, or a 401 JSON response. */
export async function requireCustomer(_req: NextRequest): Promise<string | Response> {
  const phone = await getCustomerSession();
  if (!phone) return NextResponse.json({ error: "Please sign in to your account." }, { status: 401 });
  return phone;
}

/** Run fn against the synced DB inside the write lock, map errors to JSON. */
export async function handle<T>(fn: (db: DB) => T | Promise<T>, opts: { admin?: NextRequest } = {}) {
  if (opts.admin && !(await isAdmin(opts.admin))) return NextResponse.json({ error: "Staff sign-in required." }, { status: 401 });
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
