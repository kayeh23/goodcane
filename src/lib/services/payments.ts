import { AppError } from "../service";
import type { DB, LineItem, Order } from "../types";
import { itemsTotal } from "../util";

export interface PaymentCalculation {
  totalInCedis: number;
  payableInCedis: number;
  isDeposit: boolean;
  depositPercent: number;
}

/**
 * Checks whether an order contains large-format made-to-order items (Tigernut 2L or 4L).
 * Per the sprint plan, large-format items require a 50% non-refundable deposit.
 */
export function hasLargeFormatItem(items: LineItem[]): boolean {
  return items.some(
    (item) =>
      item.productId.toLowerCase() === "tigernut" &&
      (item.sizeId.toLowerCase() === "2l" || item.sizeId.toLowerCase() === "4l")
  );
}

/**
 * Calculates payable amount in GHS Cedis, factoring in large-format deposit rules.
 */
export function calculatePaymentAmount(items: LineItem[]): PaymentCalculation {
  const total = itemsTotal(items);
  const requiresDeposit = hasLargeFormatItem(items);

  if (requiresDeposit) {
    const depositAmount = Math.round((total * 0.5) * 100) / 100;
    return {
      totalInCedis: total,
      payableInCedis: depositAmount,
      isDeposit: true,
      depositPercent: 50,
    };
  }

  return {
    totalInCedis: total,
    payableInCedis: total,
    isDeposit: false,
    depositPercent: 100,
  };
}

/**
 * Validates an order's readiness for payment and returns customer and amount context.
 */
export function getOrderForPayment(db: DB, orderId: string) {
  const order = db.orders.find((o) => o.id === orderId);
  if (!order) {
    throw new AppError("Order not found.", 404);
  }

  if (order.status === "cancelled") {
    throw new AppError("This order was cancelled and cannot be paid.", 409);
  }

  if (order.status === "paid") {
    throw new AppError("This order has already been paid.", 409);
  }

  if (order.status !== "confirmed" && order.status !== "requested") {
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
  amountPaidInCedis: number;
  now?: Date;
}

/**
 * Updates order status to 'paid' idempotently upon successful gateway payment.
 */
export function recordPaymentSuccess(
  db: DB,
  params: RecordPaymentParams
): { order: Order; alreadyPaid: boolean } {
  const order = db.orders.find((o) => o.id === params.orderId);
  if (!order) {
    throw new AppError(`Order ${params.orderId} not found.`, 404);
  }

  // Idempotency: if already paid, do not re-apply status or duplicate events
  if (order.status === "paid") {
    return { order, alreadyPaid: true };
  }

  const now = params.now ?? new Date();
  const channelNote = params.channel ? ` via ${params.channel}` : "";
  const note = `Payment received (${params.amountPaidInCedis.toFixed(2)} GHS${channelNote}, ref: ${params.reference})`;

  order.status = "paid";
  order.events.push({
    at: now.toISOString(),
    status: "paid",
    by: "system",
    note,
  });

  return { order, alreadyPaid: false };
}
