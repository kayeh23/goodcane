import { boolean, integer, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import type { Fulfilment, LineItem, OrderEvent } from "../types";

export const appMeta = pgTable("app_meta", {
  id: integer("id").primaryKey(),
  version: integer("version").notNull(),
  seededAt: text("seeded_at").notNull(),
});

export const customers = pgTable(
  "customers",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    remindersOptIn: boolean("reminders_opt_in").notNull().default(false),
    remindersOptInAt: text("reminders_opt_in_at"),
    createdAt: text("created_at").notNull(),
    sample: boolean("sample").notNull().default(false),
  },
  (t) => [uniqueIndex("customers_phone_idx").on(t.phone)],
);

export const standingOrders = pgTable("standing_orders", {
  id: text("id").primaryKey(),
  customerId: text("customer_id")
    .notNull()
    .references(() => customers.id),
  itemsJson: jsonb("items_json").$type<LineItem[]>().notNull(),
  fulfilmentJson: jsonb("fulfilment_json").$type<Fulfilment>().notNull(),
  status: text("status").notNull(),
  startBatch: text("start_batch").notNull(),
  skipBatches: jsonb("skip_batches").$type<string[]>().notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  sample: boolean("sample").notNull().default(false),
});

export const orders = pgTable(
  "orders",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id),
    batchDate: text("batch_date").notNull(),
    itemsJson: jsonb("items_json").$type<LineItem[]>().notNull(),
    fulfilmentJson: jsonb("fulfilment_json").$type<Fulfilment>().notNull(),
    status: text("status").notNull(),
    source: text("source").notNull(),
    total: integer("total").notNull(),
    standingOrderId: text("standing_order_id").references(() => standingOrders.id),
    reminderId: text("reminder_id"),
    cancelledBy: text("cancelled_by"),
    cancelReason: text("cancel_reason"),
    createdAt: text("created_at").notNull(),
    eventsJson: jsonb("events_json").$type<OrderEvent[]>().notNull(),
    notifiedAt: text("notified_at"),
    sample: boolean("sample").notNull().default(false),
  },
  (t) => [uniqueIndex("orders_code_idx").on(t.code)],
);

export const reminders = pgTable("reminders", {
  id: text("id").primaryKey(),
  customerId: text("customer_id")
    .notNull()
    .references(() => customers.id),
  batchDate: text("batch_date").notNull(),
  basedOnOrderId: text("based_on_order_id").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  decidedAt: text("decided_at"),
  openedAt: text("opened_at"),
  sample: boolean("sample").notNull().default(false),
});

export const forecasts = pgTable("forecasts", {
  batchDate: text("batch_date").primaryKey(),
  standingUnits: integer("standing_units").notNull(),
  oneOffUnits: integer("one_off_units").notNull(),
  totalUnits: integer("total_units").notNull(),
  method: text("method").notNull(),
  createdAt: text("created_at").notNull(),
});

/** Person B reads this for staff login. This module does not hash passwords. */
export const staffUsers = pgTable(
  "staff_users",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull(),
  },
  (t) => [uniqueIndex("staff_users_username_idx").on(t.username)],
);
