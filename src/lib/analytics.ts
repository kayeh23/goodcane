import { ASSUMPTIONS, PRODUCTS, getPickup, getProduct } from "./config";
import { addWeeks, cutoffFor, nextBatch } from "./dates";
import { FORECAST_METHOD, forecastFor, standingAppliesTo } from "./services/batch";
import { getPackingStage, type PackingStage } from "./services/orders";
import type { DB, Order } from "./types";
import { fmtPhone, isFirm, isLive, itemsTotal, litresOf, skuKey, unitsOf } from "./util";

export const SKUS = PRODUCTS.flatMap((p) => p.sizes.map((s) => ({ key: skuKey(p.id, s.id), productId: p.id, sizeId: s.id, name: p.name, color: p.color, size: s.label, ml: s.ml })));

export function decorate(db: DB, o: Order) {
  const c = db.customers.find((x) => x.id === o.customerId);
  const prior = db.orders.some((x) => x.customerId === o.customerId && isLive(x) && x.batchDate < o.batchDate);
  return {
    ...o,
    customerName: c?.name ?? "?",
    customerPhone: c ? fmtPhone(c.phone) : "",
    customerSample: c?.sample ?? true,
    remindersOptIn: c?.remindersOptIn ?? false,
    returning: prior,
    total: itemsTotal(o.items),
    units: unitsOf(o.items),
    fulfilmentLabel: o.fulfilment.type === "pickup" ? `Pickup · ${getPickup(o.fulfilment.pointId)?.name}` : `Delivery · ${o.fulfilment.area}${o.fulfilment.landmark ? ` (${o.fulfilment.landmark})` : ""}`,
    packingStage: getPackingStage(o),
  };
}
export type DecoratedOrder = ReturnType<typeof decorate>;
export type { PackingStage };

export function overview(db: DB, now = new Date()) {
  const B = nextBatch(now);
  const batchOrders = db.orders.filter((o) => o.batchDate === B);
  const rows = SKUS.map((s) => ({ ...s, requested: 0, confirmed: 0, paid: 0 }));
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const counts = { requested: 0, confirmed: 0, paid: 0, cancelled: 0 };
  const units = { requested: 0, confirmed: 0, paid: 0, cancelled: 0 };
  for (const o of batchOrders) {
    counts[o.status]++;
    units[o.status] += unitsOf(o.items);
    if (o.status === "cancelled") continue;
    for (const i of o.items) {
      const r = byKey.get(skuKey(i.productId, i.sizeId));
      if (r) r[o.status] += i.qty;
    }
  }
  const firmItems = batchOrders.filter(isFirm).flatMap((o) => o.items);
  const pendingItems = batchOrders.filter((o) => o.status === "requested").flatMap((o) => o.items);
  const sugarcaneFirm = firmItems.filter((i) => i.productId !== "tigernut");
  const tigernutFirm = firmItems.filter((i) => i.productId === "tigernut");

  const standingAll = db.standing.filter((s) => s.status !== "cancelled");
  const standingThis = batchOrders.filter((o) => o.standingOrderId);
  const standing = {
    active: db.standing.filter((s) => s.status === "active").length,
    paused: db.standing.filter((s) => s.status === "paused").length,
    skippingThis: standingAll.filter((s) => s.status === "active" && s.skipBatches.includes(B)).length,
    confirmedThis: standingThis.filter(isFirm).length,
    awaitingThis: standingThis.filter((o) => o.status === "requested").length,
  };

  // 4-batch outlook
  type OutlookWeek = { batchDate: string; firm: number; pending: number; standing: number; oneOff: number; total: number; kind: "orders" | "forecast"; bySku: Map<string, { standing: number; oneOff: number }> };
  const outlook: OutlookWeek[] = [];
  for (let k = 0; k < ASSUMPTIONS.outlookWeeks; k++) {
    const w = addWeeks(B, k);
    const f = forecastFor(db, w, B);
    if (k === 0) {
      outlook.push({ batchDate: w, firm: units.confirmed + units.paid, pending: units.requested, standing: 0, oneOff: 0, total: units.confirmed + units.paid + units.requested, kind: "orders", bySku: f.bySku });
    } else {
      outlook.push({ batchDate: w, firm: 0, pending: 0, standing: f.standing, oneOff: f.oneOff, total: f.standing + f.oneOff, kind: "forecast", bySku: f.bySku });
    }
  }
  const outlookSku = SKUS.map((s) => ({
    ...s,
    weeks: outlook.map((w, k) => {
      if (k === 0) return (byKey.get(s.key)?.confirmed ?? 0) + (byKey.get(s.key)?.paid ?? 0) + (byKey.get(s.key)?.requested ?? 0);
      const v = w.bySku.get(s.key);
      return Math.round((v?.standing ?? 0) + (v?.oneOff ?? 0));
    }),
  }));

  return {
    batchDate: B,
    cutoff: cutoffFor(B).toISOString(),
    counts,
    units,
    rows,
    prep: {
      sugarcaneLitres: litresOf(sugarcaneFirm),
      tigernutLitres: litresOf(tigernutFirm),
      pendingLitres: litresOf(pendingItems),
    },
    standing,
    outlook: outlook.map((w) => ({ batchDate: w.batchDate, firm: w.firm, pending: w.pending, standing: w.standing, oneOff: w.oneOff, total: w.total, kind: w.kind })),
    outlookSku,
    method: FORECAST_METHOD,
    pendingReminders: db.reminders.filter((r) => r.status === "pending" && r.batchDate === B).length,
  };
}

export function metrics(db: DB, now = new Date()) {
  const B = nextBatch(now);
  const batches = [...new Set(db.orders.map((o) => o.batchDate))].filter((b) => b <= B).sort();
  const seenBefore = new Set<string>();
  const weeks = batches.map((b) => {
    const os = db.orders.filter((o) => o.batchDate === b);
    const live = os.filter(isLive);
    const firm = os.filter(isFirm);
    const custs = new Set(live.map((o) => o.customerId));
    const returning = [...custs].filter((c) => seenBefore.has(c)).length;
    custs.forEach((c) => seenBefore.add(c));
    const actualUnits = firm.reduce((s, o) => s + unitsOf(o.items), 0);
    const snap = db.forecasts.find((f) => f.batchDate === b);
    const complete = b < B;
    const ape = complete && snap && actualUnits > 0 ? Math.abs(actualUnits - snap.totalUnits) / actualUnits : null;
    return {
      batchDate: b,
      complete,
      orders: os.length,
      confirmedOrders: firm.length,
      paidOrders: os.filter((o) => o.status === "paid").length,
      cancelled: os.filter((o) => o.status === "cancelled").length,
      cancelledByCustomer: os.filter((o) => o.status === "cancelled" && o.cancelledBy === "customer").length,
      cancelledByBusiness: os.filter((o) => o.status === "cancelled" && o.cancelledBy === "business").length,
      cancelRate: os.length ? os.filter((o) => o.status === "cancelled").length / os.length : 0,
      customers: custs.size,
      returning,
      returningShare: custs.size ? returning / custs.size : 0,
      actualUnits,
      forecastUnits: snap?.totalUnits ?? null,
      ape,
      standingOrders: live.filter((o) => o.standingOrderId).length,
    };
  });

  const completed = weeks.filter((w) => w.complete);
  const repeatRate = (from: string) => {
    const per = new Map<string, Set<string>>();
    for (const o of db.orders) {
      if (!isLive(o) || o.batchDate < from || o.batchDate >= B) continue;
      if (!per.has(o.customerId)) per.set(o.customerId, new Set());
      per.get(o.customerId)!.add(o.batchDate);
    }
    const all = per.size;
    const rep = [...per.values()].filter((s) => s.size >= 2).length;
    return { customers: all, repeaters: rep, rate: all ? rep / all : 0 };
  };
  const apes = completed.map((w) => w.ape).filter((x): x is number => x !== null);
  const mape = apes.length ? apes.reduce((a, b) => a + b, 0) / apes.length : null;
  const last4 = completed.slice(-4);
  const reminders = db.reminders.filter((r) => r.status === "opened_whatsapp" && r.batchDate < B);
  const converted = reminders.filter((r) => db.orders.some((o) => o.customerId === r.customerId && o.batchDate === r.batchDate && isLive(o)));

  return {
    batchDate: B,
    weeks,
    repeat: { all: repeatRate(batches[0] ?? B), last4: repeatRate(addWeeks(B, -4)) },
    confirmedWeeklyAvg4: last4.length ? last4.reduce((s, w) => s + w.confirmedOrders, 0) / last4.length : 0,
    cancelRate4: last4.reduce((s, w) => s + w.orders, 0) ? last4.reduce((s, w) => s + w.cancelled, 0) / last4.reduce((s, w) => s + w.orders, 0) : 0,
    mape,
    forecastWeeks: apes.length,
    reminders: { sent: reminders.length, converted: converted.length, rate: reminders.length ? converted.length / reminders.length : 0 },
    optIn: { optedIn: db.customers.filter((c) => c.remindersOptIn).length, customers: db.customers.length },
    method: FORECAST_METHOD,
  };
}

export function batchCsv(db: DB, batchDate: string) {
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ["batch_date", "order_code", "status", "source", "customer_name", "phone", "fulfilment", "product", "size", "qty", "unit_price_ghs_to_confirm", "line_total_ghs", "sample_data"];
  const lines = [header.join(",")];
  for (const o of db.orders.filter((x) => x.batchDate === batchDate).sort((a, b) => a.code.localeCompare(b.code))) {
    const d = decorate(db, o);
    for (const i of o.items)
      lines.push([o.batchDate, o.code, o.status, o.source, d.customerName, d.customerPhone, d.fulfilmentLabel, getProduct(i.productId)?.name, i.sizeId, i.qty, i.unitPrice, i.qty * i.unitPrice, o.sample ? "SAMPLE" : "demo-entry"].map(esc).join(","));
  }
  return lines.join("\n") + "\n";
}

export { standingAppliesTo };
