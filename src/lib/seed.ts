/**
 * SAMPLE DATA ONLY. Every customer, order, reminder and number generated here
 * is fictional and labelled "Sample". Nothing reflects GoodCane's real
 * customers, sales or stock. Deterministic so demos are repeatable.
 */
import { ASSUMPTIONS, DELIVERY_AREAS, PICKUP_POINTS, getSize, pickupAvailable } from "./config";
import { addWeeks, cutoffFor, nextBatch } from "./dates";
import { FORECAST_METHOD, draftReminder, sync } from "./services/batch";
import type { Customer, DB, Fulfilment, LineItem, Order, OrderStatus, Reminder, StandingOrder } from "./types";
import { isFirm, isLive, skuKey, unitsOf } from "./util";

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const li = (productId: string, sizeId: string, qty: number): LineItem => ({ productId, sizeId, qty, unitPrice: getSize(productId, sizeId)!.price });

export function buildSeed(now: Date): DB {
  const rnd = mulberry32(20261024);
  const pick = <T,>(xs: T[], w?: number[]) => {
    const ws = w ?? xs.map(() => 1);
    let r = rnd() * ws.reduce((a, b) => a + b, 0);
    for (let i = 0; i < xs.length; i++) if ((r -= ws[i]) <= 0) return xs[i];
    return xs[xs.length - 1];
  };
  const B = nextBatch(now);
  const iso = (d: Date) => d.toISOString();
  const db: DB = { version: 1, seededAt: iso(now), customers: [], orders: [], standing: [], reminders: [], forecasts: [] };
  let n = 0;
  let code = 1000;

  const firstBatch = addWeeks(B, -8);
  for (let i = 1; i <= 28; i++) {
    const optIn = i <= 6 ? i % 2 === 1 : rnd() < 0.62;
    const c: Customer = {
      id: `c_sample${i}`,
      name: `Sample Customer ${i}`,
      phone: `020000${String(i).padStart(4, "0")}`,
      remindersOptIn: optIn,
      remindersOptInAt: optIn ? iso(cutoffFor(firstBatch)) : undefined,
      createdAt: iso(new Date(cutoffFor(firstBatch).getTime() - 3 * 86400000)),
      sample: true,
    };
    db.customers.push(c);
  }
  const cust = (i: number) => db.customers[i - 1];

  type Def = { c: number; start: number; end?: number; endStatus?: "paused" | "cancelled"; items: LineItem[]; f: Fulfilment; skip?: number[] };
  const defs: Def[] = [
    { c: 1, start: -8, items: [li("raw", "330ml", 2), li("tigernut", "500ml", 1)], f: { type: "pickup", pointId: "adenta" } },
    { c: 2, start: -7, items: [li("lemon-ginger", "330ml", 3)], f: { type: "pickup", pointId: "green-butterfly" } },
    { c: 3, start: -6, items: [li("mint-lemon", "330ml", 2), li("passion", "330ml", 2)], f: { type: "pickup", pointId: "adenta" }, skip: [-4] },
    { c: 4, start: -5, items: [li("tigernut", "2L", 1)], f: { type: "delivery", area: DELIVERY_AREAS[0], landmark: "Sample landmark" } },
    { c: 5, start: -3, items: [li("raw", "330ml", 1), li("passion", "330ml", 1)], f: { type: "pickup", pointId: "green-butterfly" } },
    { c: 6, start: -2, items: [li("tigernut", "330ml", 2), li("raw", "330ml", 2)], f: { type: "pickup", pointId: "adenta" } },
    { c: 7, start: -6, end: -2, endStatus: "paused", items: [li("mint-lemon", "330ml", 2)], f: { type: "pickup", pointId: "adenta" } },
    { c: 8, start: -7, end: -4, endStatus: "cancelled", items: [li("lemon-ginger", "330ml", 2)], f: { type: "pickup", pointId: "adenta" } },
  ];
  const standingAt = (d: Def, k: number) => d.start <= k && (d.end === undefined || k < d.end) && !(d.skip ?? []).includes(k);

  for (const d of defs) {
    const s: StandingOrder = {
      id: `s_sample${d.c}`,
      customerId: cust(d.c).id,
      items: d.items,
      fulfilment: d.f,
      status: d.endStatus ?? "active",
      startBatch: addWeeks(B, d.start),
      skipBatches: (d.skip ?? []).map((k) => addWeeks(B, k)),
      createdAt: iso(new Date(cutoffFor(addWeeks(B, d.start)).getTime() - 2 * 86400000)),
      updatedAt: iso(cutoffFor(addWeeks(B, d.end ?? d.start))),
      sample: true,
    };
    db.standing.push(s);
  }

  const mkOrder = (c: Customer, w: string, items: LineItem[], f: Fulfilment, status: OrderStatus, source: Order["source"], createdAt: Date, extra: Partial<Order> = {}): Order => {
    const o: Order = {
      id: `o_sample${++n}`,
      code: `GC-${++code}`,
      customerId: c.id,
      batchDate: w,
      items,
      fulfilment: f,
      status,
      source,
      createdAt: iso(createdAt),
      events: [{ at: iso(createdAt), status: "created", by: source === "standing" ? "system" : "customer" }],
      sample: true,
      ...extra,
    };
    const later = (h: number) => iso(new Date(Math.min(createdAt.getTime() + h * 3600000, now.getTime() - 60000)));
    if (status === "confirmed" || status === "paid") o.events.push({ at: later(5), status: "confirmed", by: "business" });
    if (status === "paid") o.events.push({ at: later(20), status: "paid", by: "business", note: "Marked paid manually (no payment integration)" });
    if (status === "cancelled") o.events.push({ at: later(8), status: "cancelled", by: o.cancelledBy ?? "business", note: o.cancelReason });
    db.orders.push(o);
    return o;
  };

  const productW = [3, 2, 2, 2, 2];
  const products = ["raw", "lemon-ginger", "mint-lemon", "passion", "tigernut"];
  const randomItems = (): LineItem[] => {
    const lines = rnd() < 0.35 ? 2 : 1;
    const out = new Map<string, LineItem>();
    for (let l = 0; l < lines; l++) {
      const p = pick(products, productW);
      const size = p === "tigernut" ? pick(["330ml", "500ml", "2L", "4L"], [1, 2, 0.5, 0.25]) : "330ml";
      const qty = size === "2L" || size === "4L" ? 1 : 1 + Math.floor(rnd() * 3);
      out.set(skuKey(p, size), li(p, size, qty));
    }
    return [...out.values()];
  };
  const randomPickup = (w: string): Fulfilment => {
    if (rnd() < 0.12) return { type: "delivery", area: pick(DELIVERY_AREAS) };
    const pts = PICKUP_POINTS.filter((p) => pickupAvailable(p.id, w));
    return { type: "pickup", pointId: pick(pts.map((p) => p.id), pts.map((p) => (p.id === "adenta" ? 3 : 2))) };
  };
  const oneOffPool = Array.from({ length: 20 }, (_, i) => i + 9);
  const oneOffFirmUnits = new Map<string, number>();

  for (let k = -8; k <= 0; k++) {
    const w = addWeeks(B, k);
    const cutoff = cutoffFor(w);
    const createdAt = () => (k === 0 ? new Date(now.getTime() - (1 + rnd() * 40) * 3600000) : new Date(cutoff.getTime() - rnd() * 4 * 86400000));

    // forecast snapshot (what the method would have said before this batch)
    if (k >= -7 && k < 0) {
      let standingUnits = 0;
      for (const d of defs) if (standingAt(d, k)) standingUnits += unitsOf(d.items);
      const prev = [1, 2, 3, 4].map((j) => addWeeks(w, -j)).filter((x) => x >= firstBatch).slice(0, ASSUMPTIONS.forecastWindowWeeks);
      const oneOff = Math.round(prev.reduce((s, x) => s + (oneOffFirmUnits.get(x) ?? 0), 0) / prev.length);
      db.forecasts.push({ batchDate: w, standingUnits, oneOffUnits: oneOff, totalUnits: standingUnits + oneOff, method: FORECAST_METHOD, createdAt: iso(new Date(cutoff.getTime() - 5 * 86400000)) });
    }

    if (k < 0) {
      // standing-order requests for past batches
      for (const d of defs) {
        if (!standingAt(d, k)) continue;
        const cancel = rnd() < 0.05;
        mkOrder(cust(d.c), w, d.items, d.f.type === "pickup" && !pickupAvailable(d.f.pointId, w) ? { type: "pickup", pointId: "adenta" } : d.f, cancel ? "cancelled" : "paid", "standing", new Date(cutoff.getTime() - 4 * 86400000), {
          standingOrderId: `s_sample${d.c}`,
          ...(cancel ? { cancelledBy: "customer" as const, cancelReason: "Skipped — travelling (sample)" } : {}),
        });
      }
      // reminders sent for this batch (simulated, approved by business)
      const reminded = new Map<string, Reminder>();
      if (k >= -7) {
        for (const c of db.customers) {
          if (!c.remindersOptIn) continue;
          if (defs.some((d) => d.c === Number(c.id.replace("c_sample", "")) && standingAt(d, k))) continue;
          const recent = db.orders.filter((o) => o.customerId === c.id && isLive(o) && (o.batchDate === addWeeks(w, -1) || o.batchDate === addWeeks(w, -2))).sort((a, b) => b.batchDate.localeCompare(a.batchDate))[0];
          if (!recent) continue;
          const r = draftReminder(c, recent, w, new Date(cutoff.getTime() - 2 * 86400000), true);
          r.id = `r_sample${db.reminders.length + 1}`;
          const approved = rnd() < 0.85;
          r.status = approved ? "opened_whatsapp" : "dismissed";
          r.decidedAt = iso(new Date(cutoff.getTime() - 1.8 * 86400000));
          if (approved) r.openedAt = r.decidedAt;
          db.reminders.push(r);
          if (approved) reminded.set(c.id, r);
        }
      }
      // one-off orders
      const count = Math.round(3 + (8 + k) * 0.55 + rnd() * 2);
      const chosen = new Set<number>();
      while (chosen.size < count) {
        const weights = oneOffPool.map((i) => (chosen.has(i) ? 0 : (i <= 16 ? 3 : 1) * (reminded.has(`c_sample${i}`) ? 2.5 : 1)));
        chosen.add(pick(oneOffPool, weights));
      }
      let firmUnits = 0;
      for (const i of chosen) {
        const c = cust(i);
        const r = rnd();
        const status: OrderStatus = r < 0.06 ? "cancelled" : "paid";
        const byCustomer = rnd() < 0.5;
        const hadPrior = db.orders.some((o) => o.customerId === c.id && isLive(o));
        const o = mkOrder(c, w, randomItems(), randomPickup(w), status, hadPrior && rnd() < 0.55 ? "reorder" : "web", createdAt(), {
          reminderId: reminded.get(c.id)?.id,
          ...(status === "cancelled" ? { cancelledBy: byCustomer ? ("customer" as const) : ("business" as const), cancelReason: byCustomer ? "Plans changed (sample)" : "Tigernut batch full (sample)" } : {}),
        });
        if (isFirm(o)) firmUnits += unitsOf(o.items);
      }
      oneOffFirmUnits.set(w, firmUnits);
    }
  }

  // ---- current open batch B: standing requests, reminders & snapshot via sync
  sync(db, now, true);
  code = Math.max(code, ...db.orders.map((o) => Number(o.code.slice(3)) || 0));
  // ...renumber anything sync created with random ids so seeds look tidy
  const standingThis = db.orders.filter((o) => o.batchDate === B && o.standingOrderId);
  standingThis.forEach((o, idx) => {
    o.createdAt = iso(new Date(now.getTime() - (30 - idx) * 3600000));
    o.events[0].at = o.createdAt;
    if (idx < 3) {
      o.status = "confirmed";
      o.events.push({ at: iso(new Date(now.getTime() - (20 - idx) * 3600000)), status: "confirmed", by: "business" });
    }
    if (idx === 0) {
      o.status = "paid";
      o.events.push({ at: iso(new Date(now.getTime() - 10 * 3600000)), status: "paid", by: "business", note: "Marked paid manually (no payment integration)" });
    }
  });
  // one-off orders for B in mixed states
  const plan: Array<[number, OrderStatus]> = [
    [9, "paid"], [11, "paid"], [12, "confirmed"], [14, "confirmed"], [10, "requested"], [17, "requested"], [21, "requested"], [23, "requested"], [15, "cancelled"],
  ];
  for (const [i, status] of plan) {
    const c = cust(i);
    mkOrder(c, B, randomItems(), i === 21 ? { type: "delivery", area: DELIVERY_AREAS[1] } : randomPickup(B), status, db.orders.some((o) => o.customerId === c.id) ? "reorder" : "web", new Date(now.getTime() - (2 + rnd() * 40) * 3600000), status === "cancelled" ? { cancelledBy: "customer", cancelReason: "Ordered twice by mistake (sample)" } : {});
  }
  // drop pending reminders for customers who have now ordered for B
  db.reminders = db.reminders.filter((r) => !(r.status === "pending" && db.orders.some((o) => o.customerId === r.customerId && o.batchDate === B && isLive(o))));
  db.reminders.forEach((r) => (r.sample = true));
  return db;
}
