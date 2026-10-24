import { ASSUMPTIONS, DELIVERY_AREAS, getPickup, getSize, pickupAvailable } from "../config";
import { fmtBatch, isOpen, nextBatch } from "../dates";
import { AppError } from "../errors";
import type { Customer, DB, Fulfilment, LineItem, Order, OrderStatus, StandingOrder } from "../types";
import { isLive, newId, normalisePhone, skuKey } from "../util";
import { assertBatchCapacity } from "./capacity";
import { customerByPhone } from "./customer";

export function nextCode(db: DB) {
  const max = db.orders.reduce((m, o) => Math.max(m, Number(o.code.slice(3)) || 0), 1000);
  return `GC-${max + 1}`;
}

function cleanItems(raw: unknown): LineItem[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new AppError("Add at least one drink.");
  const merged = new Map<string, LineItem>();
  for (const r of raw as Array<Record<string, unknown>>) {
    const productId = String(r.productId ?? "");
    const sizeId = String(r.sizeId ?? "");
    const qty = Math.floor(Number(r.qty));
    const size = getSize(productId, sizeId);
    if (!size) throw new AppError("Unknown drink or size.");
    if (!Number.isFinite(qty) || qty < 1 || qty > ASSUMPTIONS.maxQtyPerLine)
      throw new AppError(`Quantity must be 1–${ASSUMPTIONS.maxQtyPerLine}.`);
    const k = skuKey(productId, sizeId);
    const prev = merged.get(k);
    merged.set(k, { productId, sizeId, qty: Math.min(ASSUMPTIONS.maxQtyPerLine, (prev?.qty ?? 0) + qty), unitPrice: size.price });
  }
  return [...merged.values()];
}

function cleanFulfilment(raw: unknown, batchDate: string): Fulfilment {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (r.type === "pickup") {
    const pointId = String(r.pointId ?? "");
    if (!getPickup(pointId)) throw new AppError("Choose a pickup point.");
    if (!pickupAvailable(pointId, batchDate))
      throw new AppError(`${getPickup(pointId)!.name} isn't open for the ${fmtBatch(batchDate)} batch. ${getPickup(pointId)!.availabilityNote ?? ""}`, 409);
    return { type: "pickup", pointId };
  }
  if (r.type === "delivery") {
    const area = String(r.area ?? "");
    if (!DELIVERY_AREAS.includes(area)) throw new AppError("Choose a delivery area.");
    const landmark = String(r.landmark ?? "").trim().slice(0, 120);
    return { type: "delivery", area, landmark: landmark || undefined };
  }
  throw new AppError("Choose pickup or delivery.");
}

export function pushEvent(o: Order, status: Order["events"][number]["status"], by: "customer" | "business" | "system", note?: string, at = new Date()) {
  o.events.push({ at: at.toISOString(), status, by, note });
}

export function makeOrder(db: DB, p: { customer: Customer; batchDate: string; items: LineItem[]; fulfilment: Fulfilment; source: Order["source"]; standingOrderId?: string; now: Date; sample: boolean }): Order {
  const o: Order = {
    id: newId("o"),
    code: nextCode(db),
    customerId: p.customer.id,
    batchDate: p.batchDate,
    items: p.items.map((i) => ({ ...i })),
    fulfilment: { ...p.fulfilment },
    status: "requested",
    source: p.source,
    standingOrderId: p.standingOrderId,
    createdAt: p.now.toISOString(),
    events: [],
    sample: p.sample,
  };
  pushEvent(o, "created", p.source === "standing" ? "system" : "customer", p.source === "standing" ? "Created from weekly standing order" : undefined, p.now);
  const rem = db.reminders.find((r) => r.customerId === p.customer.id && r.batchDate === p.batchDate && (r.status === "approved" || r.status === "opened_whatsapp"));
  if (rem && p.source !== "standing") o.reminderId = rem.id;
  db.orders.push(o);
  return o;
}

export function createOrder(db: DB, body: Record<string, unknown>, now = new Date()) {
  const batchDate = nextBatch(now);
  const name = String(body.name ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
  if (name.length < 2) throw new AppError("Please enter your name.");
  const phone = normalisePhone(String(body.phone ?? ""));
  if (!phone) throw new AppError("Please enter a valid Ghana phone number (e.g. 020 000 0001).");
  const items = cleanItems(body.items);
  const fulfilment = cleanFulfilment(body.fulfilment, batchDate);
  const remindersOptIn = body.remindersOptIn === true;
  const repeatWeekly = body.repeatWeekly === true;

  assertBatchCapacity(db, batchDate, items);

  let customer = customerByPhone(db, phone);
  if (!customer) {
    customer = { id: newId("c"), name, phone, remindersOptIn: false, createdAt: now.toISOString(), sample: false };
    db.customers.push(customer);
  }
  customer.name = name;
  if (remindersOptIn && !customer.remindersOptIn) {
    customer.remindersOptIn = true;
    customer.remindersOptInAt = now.toISOString();
  }

  let standingOrderId: string | undefined;
  if (repeatWeekly) {
    const s: StandingOrder = {
      id: newId("s"),
      customerId: customer.id,
      items: items.map((i) => ({ ...i })),
      fulfilment,
      status: "active",
      startBatch: batchDate,
      skipBatches: [],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      sample: false,
    };
    db.standing.push(s);
    standingOrderId = s.id;
  }
  const order = makeOrder(db, { customer, batchDate, items, fulfilment, source: body.source === "reorder" ? "reorder" : "web", standingOrderId, now, sample: false });
  for (const r of db.reminders) if (r.customerId === customer.id && r.batchDate === batchDate && r.status === "pending") r.status = "dismissed";
  return { order, customer };
}

function ownedOrder(db: DB, orderId: string, phoneRaw: unknown) {
  const phone = normalisePhone(String(phoneRaw ?? ""));
  const o = db.orders.find((x) => x.id === orderId);
  const c = o && db.customers.find((x) => x.id === o.customerId);
  if (!o || !c || c.phone !== phone) throw new AppError("Order not found for this phone number.", 404);
  return { o, c };
}

export function reorder(db: DB, orderId: string, phone: unknown, now = new Date()) {
  const { o, c } = ownedOrder(db, orderId, phone);
  return createOrder(db, { name: c.name, phone: c.phone, items: o.items, fulfilment: o.fulfilment, remindersOptIn: false, repeatWeekly: false, source: "reorder" }, now);
}

export function customerCancel(db: DB, orderId: string, phone: unknown, now = new Date()) {
  const { o } = ownedOrder(db, orderId, phone);
  if (o.status === "cancelled") return o;
  if (o.status === "paid") throw new AppError("This order is already paid — please contact GoodCane to change it.", 409);
  if (!isOpen(o.batchDate, now)) throw new AppError("The cutoff for this batch has passed — please contact GoodCane.", 409);
  o.status = "cancelled";
  o.cancelledBy = "customer";
  o.cancelReason = "Cancelled by customer";
  pushEvent(o, "cancelled", "customer", undefined, now);
  return o;
}

export function standingAction(db: DB, standingId: string, phoneRaw: unknown, action: string, now = new Date()) {
  const phone = normalisePhone(String(phoneRaw ?? ""));
  const s = db.standing.find((x) => x.id === standingId);
  const c = s && db.customers.find((x) => x.id === s.customerId);
  if (!s || !c || c.phone !== phone) throw new AppError("Standing order not found for this phone number.", 404);
  const B = nextBatch(now);
  const thisWeek = db.orders.find((o) => o.standingOrderId === s.id && o.batchDate === B && isLive(o));
  const dropThisWeek = (note: string, strict = false) => {
    if (!thisWeek) return;
    if (thisWeek.status === "paid") {
      if (strict) throw new AppError("This week's order is already paid — contact GoodCane to change it.", 409);
      return;
    }
    thisWeek.status = "cancelled";
    thisWeek.cancelledBy = "customer";
    thisWeek.cancelReason = note;
    pushEvent(thisWeek, "cancelled", "customer", note, now);
  };
  switch (action) {
    case "skip":
      if (s.status === "cancelled") throw new AppError("This standing order is cancelled.", 409);
      dropThisWeek("Skipped this week", true);
      if (!s.skipBatches.includes(B)) s.skipBatches.push(B);
      break;
    case "unskip":
      s.skipBatches = s.skipBatches.filter((b) => b !== B);
      break;
    case "pause":
      if (s.status !== "active") throw new AppError("Only active standing orders can be paused.", 409);
      dropThisWeek("Standing order paused");
      s.status = "paused";
      break;
    case "resume":
      if (s.status !== "paused") throw new AppError("Only paused standing orders can be resumed.", 409);
      s.status = "active";
      s.skipBatches = s.skipBatches.filter((b) => b !== B);
      break;
    case "cancel":
      dropThisWeek("Standing order cancelled");
      s.status = "cancelled";
      break;
    default:
      throw new AppError("Unknown action.");
  }
  s.updatedAt = now.toISOString();
  return s;
}

export function businessOrderAction(db: DB, orderId: string, action: string, reason?: string, now = new Date()) {
  const o = db.orders.find((x) => x.id === orderId);
  if (!o) throw new AppError("Order not found.", 404);
  const need = (from: OrderStatus[], to: OrderStatus) => {
    if (!from.includes(o.status)) throw new AppError(`Can't move a ${o.status} order to ${to}.`, 409);
  };
  switch (action) {
    case "confirm":
      need(["requested"], "confirmed");
      o.status = "confirmed";
      pushEvent(o, "confirmed", "business", undefined, now);
      break;
    case "cancel":
      need(["requested", "confirmed"], "cancelled");
      o.status = "cancelled";
      o.cancelledBy = "business";
      o.cancelReason = (reason || "Declined by GoodCane").slice(0, 120);
      pushEvent(o, "cancelled", "business", o.cancelReason, now);
      break;
    case "notified":
      o.notifiedAt = now.toISOString();
      pushEvent(o, o.status, "business", "WhatsApp confirmation opened (business sends manually)", now);
      break;
    default:
      throw new AppError("Unknown action.");
  }
  return o;
}
