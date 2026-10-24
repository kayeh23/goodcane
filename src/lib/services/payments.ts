import { AppError } from "../errors";
import type { DB, LineItem, Order, OrderStatus } from "../types";
import { itemsTotal } from "../util";

function pushEvent(o: { events: { at: string; status: OrderStatus | "created"; by: "customer" | "business" | "system"; note?: string }[] }, status: OrderStatus | "created", by: "customer" | "business" | "system", note?: string, at = new Date()) {
  o.events.push({ at: at.toISOString(), status, by, note });
}

/** Manual mark-paid (desk), when Paystack is not how this order was settled. */
export function markPaid(db: DB, orderId: string, now = new Date()) {
  const o = db.orders.find((x) => x.id === orderId);
  if (!o) throw new AppError("Order not found.", 404);
  if (o.status !== "confirmed") throw new AppError(`Can't move a ${o.status} order to paid.`, 409);
  o.status = "paid";
  pushEvent(o, "paid", "business", "Marked paid manually", now);
  return o;
}

/** Tigernut 2L and 4L take a 50% deposit. Other lines are paid in full. */
export function hasLargeFormatItem(items: LineItem[]): boolean {
  return items.some(
    (item) =>
      item.productId.toLowerCase() === "tigernut" &&
      (item.sizeId.toLowerCase() === "2l" || item.sizeId.toLowerCase() === "4l"),
  );
}

export interface PaymentCalculation {
  totalInCedis: number;
  payableInCedis: number;
  payablePesewas: number;
  isDeposit: boolean;
  depositPercent: number;
}

export function calculatePaymentAmount(items: LineItem[]): PaymentCalculation {
  const totalInCedis = itemsTotal(items);
  const totalPesewas = Math.round(totalInCedis * 100);
  const isDeposit = hasLargeFormatItem(items);
  const payablePesewas = isDeposit ? Math.round(totalPesewas / 2) : totalPesewas;
  return {
    totalInCedis,
    payableInCedis: payablePesewas / 100,
    payablePesewas,
    isDeposit,
    depositPercent: isDeposit ? 50 : 100,
  };
}

/**
 * Payment can start only after staff has confirmed the order.
 * A requested or cancelled order is not sent to Paystack.
 */
export function getOrderForPayment(db: DB, orderId: string) {
  const order = db.orders.find((o) => o.id === orderId);
  if (!order) throw new AppError("Order not found.", 404);
  if (order.status === "cancelled") throw new AppError("This order was cancelled and cannot be paid.", 409);
  if (order.status === "paid") throw new AppError("This order has already been paid.", 409);
  if (order.status !== "confirmed") {
    throw new AppError(`Cannot initialize payment for an order with status: ${order.status}.`, 409);
  }

  const customer = db.customers.find((c) => c.id === order.customerId);
  const paymentCalc = calculatePaymentAmount(order.items);

  return {
    order,
    customer,
    customerPhone: customer?.phone ?? "",
    customerName: customer?.name ?? "GoodCane Customer",
    ...paymentCalc,
  };
}

export interface RecordPaymentParams {
  orderId: string;
  reference: string;
  channel?: string;
  amountPaidPesewas: number;
  now?: Date;
}

export type RecordPaymentResult =
  | { ok: true; order: Order; alreadyPaid: boolean }
  | { ok: false; reason: string };

/**
 * Marks a confirmed order paid when the verified amount covers the payable
 * (full total, or the 50% large-format deposit). A short or cancelled payment
 * does not change the order.
 */
export function recordPaymentSuccess(db: DB, params: RecordPaymentParams): RecordPaymentResult {
  const order = db.orders.find((o) => o.id === params.orderId);
  if (!order) return { ok: false, reason: "Order not found." };
  if (order.status === "paid") return { ok: true, order, alreadyPaid: true };
  if (order.status === "cancelled") return { ok: false, reason: "Order is cancelled." };
  if (order.status !== "confirmed") return { ok: false, reason: `Order is ${order.status}, not confirmed.` };

  const payment = calculatePaymentAmount(order.items);
  if (params.amountPaidPesewas < payment.payablePesewas) {
    return {
      ok: false,
      reason: `Payment is short. Expected at least ${payment.payablePesewas} pesewas.`,
    };
  }

  const now = params.now ?? new Date();
  const channelNote = params.channel ? ` via ${params.channel}` : "";
  const amount = (params.amountPaidPesewas / 100).toFixed(2);
  const note = payment.isDeposit
    ? `Deposit received (${amount} GHS${channelNote}, ref: ${params.reference}). Balance remains due.`
    : `Payment received (${amount} GHS${channelNote}, ref: ${params.reference})`;

  order.status = "paid";
  pushEvent(order, "paid", "system", note, now);
  return { ok: true, order, alreadyPaid: false };
}
