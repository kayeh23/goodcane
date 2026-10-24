import { eq } from "drizzle-orm";
import { buildSeed } from "../seed";
import type { Customer, DB, ForecastSnapshot, Order, OrderSource, OrderStatus, Reminder, ReminderStatus, StandingOrder, StandingStatus } from "../types";
import { itemsTotal } from "../util";
import { getDrizzle, type Database } from "./client";
import * as tables from "./schema";

export type StaffUser = {
  id: string;
  username: string;
  passwordHash: string;
  role: string;
};

function asOrder(row: typeof tables.orders.$inferSelect): Order {
  return {
    id: row.id,
    code: row.code,
    customerId: row.customerId,
    batchDate: row.batchDate,
    items: row.itemsJson,
    fulfilment: row.fulfilmentJson,
    status: row.status as OrderStatus,
    source: row.source as OrderSource,
    standingOrderId: row.standingOrderId ?? undefined,
    reminderId: row.reminderId ?? undefined,
    cancelledBy: (row.cancelledBy as Order["cancelledBy"]) ?? undefined,
    cancelReason: row.cancelReason ?? undefined,
    createdAt: row.createdAt,
    events: row.eventsJson,
    notifiedAt: row.notifiedAt ?? undefined,
    sample: row.sample,
  };
}

function asCustomer(row: typeof tables.customers.$inferSelect): Customer {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    remindersOptIn: row.remindersOptIn,
    remindersOptInAt: row.remindersOptInAt ?? undefined,
    createdAt: row.createdAt,
    sample: row.sample,
  };
}

function asStanding(row: typeof tables.standingOrders.$inferSelect): StandingOrder {
  return {
    id: row.id,
    customerId: row.customerId,
    items: row.itemsJson,
    fulfilment: row.fulfilmentJson,
    status: row.status as StandingStatus,
    startBatch: row.startBatch,
    skipBatches: row.skipBatches,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    sample: row.sample,
  };
}

function asReminder(row: typeof tables.reminders.$inferSelect): Reminder {
  return {
    id: row.id,
    customerId: row.customerId,
    batchDate: row.batchDate,
    basedOnOrderId: row.basedOnOrderId,
    message: row.message,
    status: row.status as ReminderStatus,
    createdAt: row.createdAt,
    decidedAt: row.decidedAt ?? undefined,
    openedAt: row.openedAt ?? undefined,
    sample: row.sample,
  };
}

function asForecast(row: typeof tables.forecasts.$inferSelect): ForecastSnapshot {
  return {
    batchDate: row.batchDate,
    standingUnits: row.standingUnits,
    oneOffUnits: row.oneOffUnits,
    totalUnits: row.totalUnits,
    method: row.method,
    createdAt: row.createdAt,
  };
}

export async function loadDocument(db: Database = getDrizzle()): Promise<DB> {
  const [meta] = await db.select().from(tables.appMeta).limit(1);
  if (!meta) {
    const seeded = buildSeed(new Date());
    await saveDocument(seeded, db);
    return seeded;
  }
  const [customerRows, standingRows, orderRows, reminderRows, forecastRows] = await Promise.all([
    db.select().from(tables.customers),
    db.select().from(tables.standingOrders),
    db.select().from(tables.orders),
    db.select().from(tables.reminders),
    db.select().from(tables.forecasts),
  ]);
  return {
    version: 1,
    seededAt: meta.seededAt,
    customers: customerRows.map(asCustomer),
    standing: standingRows.map(asStanding),
    orders: orderRows.map(asOrder),
    reminders: reminderRows.map(asReminder),
    forecasts: forecastRows.map(asForecast),
  };
}

export async function saveDocument(doc: DB, db: Database = getDrizzle()): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(tables.reminders);
    await tx.delete(tables.orders);
    await tx.delete(tables.standingOrders);
    await tx.delete(tables.customers);
    await tx.delete(tables.forecasts);
    await tx.delete(tables.appMeta);

    await tx.insert(tables.appMeta).values({ id: 1, version: doc.version, seededAt: doc.seededAt });

    if (doc.customers.length) {
      await tx.insert(tables.customers).values(
        doc.customers.map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          remindersOptIn: c.remindersOptIn,
          remindersOptInAt: c.remindersOptInAt ?? null,
          createdAt: c.createdAt,
          sample: c.sample,
        })),
      );
    }

    if (doc.standing.length) {
      await tx.insert(tables.standingOrders).values(
        doc.standing.map((s) => ({
          id: s.id,
          customerId: s.customerId,
          itemsJson: s.items,
          fulfilmentJson: s.fulfilment,
          status: s.status,
          startBatch: s.startBatch,
          skipBatches: s.skipBatches,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
          sample: s.sample,
        })),
      );
    }

    if (doc.orders.length) {
      await tx.insert(tables.orders).values(
        doc.orders.map((o) => ({
          id: o.id,
          code: o.code,
          customerId: o.customerId,
          batchDate: o.batchDate,
          itemsJson: o.items,
          fulfilmentJson: o.fulfilment,
          status: o.status,
          source: o.source,
          total: itemsTotal(o.items),
          standingOrderId: o.standingOrderId ?? null,
          reminderId: o.reminderId ?? null,
          cancelledBy: o.cancelledBy ?? null,
          cancelReason: o.cancelReason ?? null,
          createdAt: o.createdAt,
          eventsJson: o.events,
          notifiedAt: o.notifiedAt ?? null,
          sample: o.sample,
        })),
      );
    }

    if (doc.reminders.length) {
      await tx.insert(tables.reminders).values(
        doc.reminders.map((r) => ({
          id: r.id,
          customerId: r.customerId,
          batchDate: r.batchDate,
          basedOnOrderId: r.basedOnOrderId,
          message: r.message,
          status: r.status,
          createdAt: r.createdAt,
          decidedAt: r.decidedAt ?? null,
          openedAt: r.openedAt ?? null,
          sample: r.sample,
        })),
      );
    }

    if (doc.forecasts.length) {
      await tx.insert(tables.forecasts).values(
        doc.forecasts.map((f) => ({
          batchDate: f.batchDate,
          standingUnits: f.standingUnits,
          oneOffUnits: f.oneOffUnits,
          totalUnits: f.totalUnits,
          method: f.method,
          createdAt: f.createdAt,
        })),
      );
    }
  });
}

export async function fetchOrder(id: string): Promise<Order | undefined> {
  const [row] = await getDrizzle().select().from(tables.orders).where(eq(tables.orders.id, id)).limit(1);
  return row ? asOrder(row) : undefined;
}

export async function fetchBatchOrders(batchDate: string): Promise<Order[]> {
  const rows = await getDrizzle().select().from(tables.orders).where(eq(tables.orders.batchDate, batchDate));
  return rows.map(asOrder);
}

export async function insertOrder(order: Order): Promise<Order> {
  await getDrizzle()
    .insert(tables.orders)
    .values({
      id: order.id,
      code: order.code,
      customerId: order.customerId,
      batchDate: order.batchDate,
      itemsJson: order.items,
      fulfilmentJson: order.fulfilment,
      status: order.status,
      source: order.source,
      total: itemsTotal(order.items),
      standingOrderId: order.standingOrderId ?? null,
      reminderId: order.reminderId ?? null,
      cancelledBy: order.cancelledBy ?? null,
      cancelReason: order.cancelReason ?? null,
      createdAt: order.createdAt,
      eventsJson: order.events,
      notifiedAt: order.notifiedAt ?? null,
      sample: order.sample,
    });
  return order;
}

export async function fetchStaffByUsername(username: string): Promise<StaffUser | undefined> {
  const [row] = await getDrizzle().select().from(tables.staffUsers).where(eq(tables.staffUsers.username, username)).limit(1);
  if (!row) return undefined;
  return { id: row.id, username: row.username, passwordHash: row.passwordHash, role: row.role };
}

export async function resetDocument(): Promise<DB> {
  const seeded = buildSeed(new Date());
  await saveDocument(seeded);
  return seeded;
}
