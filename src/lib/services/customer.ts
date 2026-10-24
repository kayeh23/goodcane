import { nextBatch } from "../dates";
import { AppError } from "../errors";
import type { DB } from "../types";
import { normalisePhone } from "../util";

export function customerByPhone(db: DB, phone: string) {
  return db.customers.find((c) => c.phone === phone);
}

export function activeStandingFor(db: DB, customerId: string) {
  return db.standing.filter((s) => s.customerId === customerId && s.status !== "cancelled");
}

export function setReminders(db: DB, phoneRaw: unknown, optIn: boolean, now = new Date()) {
  const phone = normalisePhone(String(phoneRaw ?? ""));
  const c = phone ? customerByPhone(db, phone) : undefined;
  if (!c) throw new AppError("No orders found for this phone number.", 404);
  c.remindersOptIn = optIn;
  c.remindersOptInAt = optIn ? now.toISOString() : undefined;
  if (!optIn) for (const r of db.reminders) if (r.customerId === c.id && (r.status === "pending" || r.status === "approved")) r.status = "dismissed";
  return c;
}

export function lookup(db: DB, phoneRaw: unknown, now = new Date()) {
  const phone = normalisePhone(String(phoneRaw ?? ""));
  if (!phone) throw new AppError("Please enter a valid Ghana phone number.");
  const c = customerByPhone(db, phone);
  const B = nextBatch(now);
  if (!c) return { customer: null, orders: [], standing: [], batchDate: B };
  return {
    customer: { name: c.name, phone: c.phone, remindersOptIn: c.remindersOptIn, sample: c.sample },
    orders: db.orders.filter((o) => o.customerId === c.id).sort((a, b) => b.batchDate.localeCompare(a.batchDate) || b.createdAt.localeCompare(a.createdAt)).slice(0, 20),
    standing: db.standing.filter((s) => s.customerId === c.id && s.status !== "cancelled").map((s) => ({ ...s, skippingNext: s.skipBatches.includes(B) })),
    batchDate: B,
  };
}
