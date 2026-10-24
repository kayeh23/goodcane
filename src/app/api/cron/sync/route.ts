import { connection, NextResponse, type NextRequest } from "next/server";
import { mutate } from "@/lib/db";
import { runScheduledSync } from "@/lib/services/cron";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  const header = req.headers.get("authorization") || "";
  return header === `Bearer ${secret}`;
}

/** Local cutoff simulation only. Production always uses the real clock. */
function nowFrom(req: NextRequest): Date {
  if (process.env.NODE_ENV === "production") return new Date();
  const at = req.nextUrl.searchParams.get("at");
  if (!at) return new Date();
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

/**
 * Daily batch worker (18:00 UTC on Vercel Hobby). GET with Authorization: Bearer CRON_SECRET.
 * Production requires CRON_SECRET. Locally, an unset secret is allowed so you can curl it.
 * Non-production may pass ?at=ISO to simulate the clock past cutoff.
 */
async function run(req: NextRequest) {
  await connection();
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (process.env.NODE_ENV === "production" && !process.env.CRON_SECRET?.trim()) {
    return NextResponse.json({ error: "CRON_SECRET is not set." }, { status: 500 });
  }
  try {
    const result = await mutate((db) => runScheduledSync(db, nowFrom(req)));
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[cron/sync]", e);
    return NextResponse.json({ error: "Sync failed." }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}
