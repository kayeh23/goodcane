import { AppError } from "../errors";
import type { DB, OrderStatus } from "../types";

function pushEvent(o: { events: { at: string; status: OrderStatus | "created"; by: "customer" | "business" | "system"; note?: string }[] }, status: OrderStatus | "created", by: "customer" | "business" | "system", note?: string, at = new Date()) {
  o.events.push({ at: at.toISOString(), status, by, note });
}

/** Manual mark-paid (desk). Person C replaces this with Paystack webhook + deposit rules. */
export function markPaid(db: DB, orderId: string, now = new Date()) {
  const o = db.orders.find((x) => x.id === orderId);
  if (!o) throw new AppError("Order not found.", 404);
  if (o.status !== "confirmed") throw new AppError(`Can't move a ${o.status} order to paid.`, 409);
  o.status = "paid";
  pushEvent(o, "paid", "business", "Marked paid manually (no payment integration)", now);
  return o;
}
