import { ASSUMPTIONS, getProduct, pickupAvailable } from "../config";
import { addWeeks, fmtBatch, fmtCutoff, nextBatch } from "../dates";
import { AppError } from "../errors";
import type { Customer, DB, Order, Reminder, StandingOrder } from "../types";
import { isFirm, isLive, litresOf, newId, skuKey } from "../util";
import { wouldExceedCapacity } from "./capacity";
import { activeStandingFor } from "./customer";
import { makeOrder, pushEvent } from "./orders";

/** Is a standing order expected to produce an order for this batch? */
export function standingAppliesTo(s: StandingOrder, batchDate: string) {
  return s.status === "active" && s.startBatch <= batchDate && !s.skipBatches.includes(batchDate);
}

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
    if (wouldExceedCapacity(db, B, litresOf(s.items))) continue;
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
  const usual = basedOn.items.map((i) => `${i.qty}\u00d7 ${getProduct(i.productId)?.short} ${i.sizeId}`).join(", ");
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

export const FORECAST_METHOD = `Standing orders expected for the batch + ${ASSUMPTIONS.forecastWindowWeeks}-batch simple moving average of one-off (non-standing) confirmed/paid bottles`;

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

export function reminderAction(db: DB, id: string, action: string, now = new Date()) {
  const r = db.reminders.find((x) => x.id === id);
  if (!r) throw new AppError("Reminder not found.", 404);
  const c = db.customers.find((x) => x.id === r.customerId);
  if (action === "open") {
    if (r.status !== "approved" && r.status !== "opened_whatsapp") throw new AppError("Approve the reminder before opening it in WhatsApp.", 409);
    if (!c?.remindersOptIn) throw new AppError("Customer has opted out of reminders.", 409);
    r.status = "opened_whatsapp";
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
