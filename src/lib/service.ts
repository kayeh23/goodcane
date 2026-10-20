import { ASSUMPTIONS, BRAND, DELIVERY_AREAS, getPickup, getProduct, getSize, pickupAvailable } from "./config";
import { addWeeks, fmtBatch, fmtCutoff, isOpen, nextBatch } from "./dates";
import type { Customer, DB, Fulfilment, LineItem, Order, OrderStatus, Reminder, StandingOrder } from "./types";
import { isFirm, isLive, newId, normalisePhone, skuKey } from "./util";

export class AppError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

// ---------------------------------------------------------------- helpers

export function nextCode(db: DB) {
  const max = db.orders.reduce((m, o) => Math.max(m, Number(o.code.slice(3)) || 0), 1000);
  return `GC-${max + 1}`;
}

export function customerByPhone(db: DB, phone: string) {
  return db.customers.find((c) => c.phone === phone);
}

export function activeStandingFor(db: DB, customerId: string) {
  return db.standing.filter((s) => s.customerId === customerId && s.status !== "cancelled");
}

/** Is a standing order expected to produce an order for this batch? */
export function standingAppliesTo(s: StandingOrder, batchDate: string) {
  return s.status === "active" && s.startBatch <= batchDate && !s.skipBatches.includes(batchDate);
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

function pushEvent(o: Order, status: Order["events"][number]["status"], by: "customer" | "business" | "system", note?: string, at = new Date()) {
  o.events.push({ at: at.toISOString(), status, by, note });
}

function makeOrder(db: DB, p: { customer: Customer; batchDate: string; items: LineItem[]; fulfilment: Fulfilment; source: Order["source"]; standingOrderId?: string; now: Date; sample: boolean }): Order {
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
  // Attribute to a reminder that was sent for this batch (for conversion metrics)
  const rem = db.reminders.find((r) => r.customerId === p.customer.id && r.batchDate === p.batchDate && (r.status === "approved" || r.status === "opened_whatsapp"));
  if (rem && p.source !== "standing") o.reminderId = rem.id;
  db.orders.push(o);
  return o;
}

// ---------------------------------------------------------------- sync

/**
 * Brings derived data up to date for the batch currently open for orders:
 *  1. standing orders create that batch's REQUEST (once)
 *  2. opted-in customers who ordered recently but not yet for this batch get a
 *     PENDING reminder draft (never sent — business approves, send is simulated)
 *  3. a forecast snapshot is stored the first time a batch becomes "next", so
 *     forecast accuracy can later be measured against actuals
 */
export function sync(db: DB, now = new Date(), sample = false) {
  const B = nextBatch(now);

  for (const s of db.standing) {
    if (!standingAppliesTo(s, B)) continue;
    if (db.orders.some((o) => o.standingOrderId === s.id && o.batchDate === B)) continue;
    const customer = db.customers.find((c) => c.id === s.customerId);
    if (!customer) continue;
    let fulfilment = s.fulfilment;
    if (fulfilment.type === "pickup" && !pickupAvailable(fulfilment.pointId, B)) fulfilment = { type: "pickup", pointId: "adenta" };
    const o = makeOrder(db, { customer, batchDate: B, items: s.items, fulfilment, source: "standing", standingOrderId: s.id, now, sample: sample || s.sample });
    if (fulfilment !== s.fulfilment) pushEvent(o, "created", "system", "Usual pickup point closed this batch — moved to Adenta shop (customer can change)");
  }

  for (const c of db.customers) {
    if (!c.remindersOptIn) continue;
    if (db.reminders.some((r) => r.customerId === c.id && r.batchDate === B)) continue;
    if (activeStandingFor(db, c.id).some((s) => s.status === "active")) continue;
    const mine = db.orders.filter((o) => o.customerId === c.id && isLive(o));
    if (mine.some((o) => o.batchDate === B)) continue;
    const recent = mine
      .filter((o) => o.batchDate < B && o.batchDate >= addWeeks(B, -ASSUMPTIONS.reminderLookbackWeeks))
      .sort((a, b) => b.batchDate.localeCompare(a.batchDate))[0];
    if (!recent) continue;
    db.reminders.push(draftReminder(c, recent, B, now, sample || c.sample));
  }

  if (!db.forecasts.some((f) => f.batchDate === B)) {
    const f = forecastFor(db, B, B);
    db.forecasts.push({ batchDate: B, standingUnits: f.standing, oneOffUnits: f.oneOff, totalUnits: f.standing + f.oneOff, method: FORECAST_METHOD, createdAt: now.toISOString() });
  }
  return B;
}

export function draftReminder(c: Customer, basedOn: Order, batchDate: string, now: Date, sample: boolean): Reminder {
  const first = c.name.split(" ")[0] === "Sample" ? c.name : c.name.split(" ")[0];
  const usual = basedOn.items.map((i) => `${i.qty}× ${getProduct(i.productId)?.short} ${i.sizeId}`).join(", ");
  return {
    id: newId("r"),
    customerId: c.id,
    batchDate,
    basedOnOrderId: basedOn.id,
    message: `Hi ${first}, GoodCane's next fresh batch is ${fmtBatch(batchDate)}. Pre-order by ${fmtCutoff(batchDate)} to reserve your usual (${usual}). Reorder in one tap: [order link]/my-orders. Reply STOP to opt out.`,
    status: "pending",
    createdAt: now.toISOString(),
    sample,
  };
}

// ---------------------------------------------------------------- forecast

export const FORECAST_METHOD = `Standing orders expected for the batch + ${ASSUMPTIONS.forecastWindowWeeks}-batch simple moving average of one-off (non-standing) confirmed/paid bottles`;

/** One-off firm units by SKU for a batch. */
function oneOffBySku(db: DB, batchDate: string) {
  const m = new Map<string, number>();
  for (const o of db.orders) {
    if (o.batchDate !== batchDate || o.standingOrderId || !isFirm(o)) continue;
    for (const i of o.items) m.set(skuKey(i.productId, i.sizeId), (m.get(skuKey(i.productId, i.sizeId)) ?? 0) + i.qty);
  }
  return m;
}

/**
 * Forecast bottles for `target`, using only completed batches before `asOf`.
 * Returns totals and per-SKU detail.
 */
export function forecastFor(db: DB, target: string, asOf: string) {
  const window: string[] = [];
  for (let k = 1; k <= ASSUMPTIONS.forecastWindowWeeks; k++) {
    const w = addWeeks(asOf, -k);
    if (db.orders.some((o) => o.batchDate === w)) window.push(w);
  }
  const bySku = new Map<string, { standing: number; oneOff: number }>();
  const add = (k: string, field: "standing" | "oneOff", n: number) => {
    const cur = bySku.get(k) ?? { standing: 0, oneOff: 0 };
    cur[field] += n;
    bySku.set(k, cur);
  };
  for (const s of db.standing) if (standingAppliesTo(s, target)) for (const i of s.items) add(skuKey(i.productId, i.sizeId), "standing", i.qty);
  if (window.length) {
    const sums = new Map<string, number>();
    for (const w of window) for (const [k, n] of oneOffBySku(db, w)) sums.set(k, (sums.get(k) ?? 0) + n);
    for (const [k, n] of sums) add(k, "oneOff", n / window.length);
  }
  let standing = 0;
  let oneOff = 0;
  for (const v of bySku.values()) {
    standing += v.standing;
    oneOff += v.oneOff;
  }
  return { standing, oneOff: Math.round(oneOff), bySku, windowWeeks: window.length };
}

// ---------------------------------------------------------------- customer actions

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
  // a pending reminder for this batch is no longer needed
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
  /** strict: refuse if already paid (skip). Otherwise a paid order stays and the change applies from next week. */
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

// ---------------------------------------------------------------- business actions

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
    case "pay":
      need(["confirmed"], "paid");
      o.status = "paid";
      pushEvent(o, "paid", "business", "Marked paid manually (no payment integration)", now);
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

export function reminderAction(db: DB, id: string, action: string, now = new Date()) {
  const r = db.reminders.find((x) => x.id === id);
  if (!r) throw new AppError("Reminder not found.", 404);
  const c = db.customers.find((x) => x.id === r.customerId);
  if (action === "open") {
    if (r.status !== "approved" && r.status !== "opened_whatsapp") throw new AppError("Approve the reminder before opening it in WhatsApp.", 409);
    if (!c?.remindersOptIn) throw new AppError("Customer has opted out of reminders.", 409);
    r.status = "opened_whatsapp"; // business sends manually in WhatsApp; nothing is sent by this app
    r.openedAt = now.toISOString();
    return r;
  }
  if (r.status !== "pending") throw new AppError("Reminder already handled.", 409);
  if (action === "approve") {
    if (!c?.remindersOptIn) throw new AppError("Customer has opted out of reminders.", 409);
    r.status = "approved";
  } else if (action === "dismiss") r.status = "dismissed";
  else throw new AppError("Unknown action.");
  r.decidedAt = now.toISOString();
  return r;
}

export { BRAND };
