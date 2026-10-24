/**
 * wa.me click-to-chat helpers. These only build links: a person must open
 * WhatsApp and press Send themselves. No WhatsApp API is used.
 */
import { getProduct, GOODCANE_WHATSAPP } from "./config";
import { fmtBatch, fmtCutoff } from "./dates";
import type { LineItem } from "./types";
import { cedis } from "./util";

/** Local Ghana number (0XXXXXXXXX) -> international digits (233XXXXXXXXX). */
export function toIntl(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.startsWith("233")) return d;
  if (d.startsWith("0")) return "233" + d.slice(1);
  return d;
}

export function waLink(phone: string, text: string) {
  return `https://wa.me/${toIntl(phone)}?text=${encodeURIComponent(text)}`;
}

export function itemsText(items: LineItem[]) {
  return items.map((i) => `${i.qty}× ${getProduct(i.productId)?.name ?? i.productId} ${i.sizeId}`).join(", ");
}

/** Formats pickup or delivery window based on the chosen collection point. */
export function getFulfilmentTimeWindow(fulfilmentLabel: string): string {
  const lower = fulfilmentLabel.toLowerCase();
  if (lower.includes("adenta")) return "Saturday 10:00 AM - 4:00 PM";
  if (lower.includes("parks") || lower.includes("gardens")) return "Saturday 9:00 AM - 2:00 PM (1st & 3rd Sat)";
  if (lower.includes("butterfly")) return "Saturday 10:00 AM - 3:00 PM";
  if (lower.includes("delivery")) return "Saturday 11:00 AM - 3:00 PM (Dispatch)";
  return "Saturday 10:00 AM - 4:00 PM";
}

/** Customer -> GoodCane: share an order request. */
export function orderToBusinessLink(o: {
  code: string;
  items: LineItem[];
  batchDate: string;
  fulfilmentLabel: string;
  name: string;
  total: number;
  status?: string;
}) {
  const text = [
    `Hi GoodCane! Pre-order request ${o.code}`,
    `Batch: ${fmtBatch(o.batchDate)}`,
    `Items: ${itemsText(o.items)}`,
    `Collection: ${o.fulfilmentLabel}`,
    `Name: ${o.name}`,
    `Estimated total: ${cedis(o.total)} (prices to confirm)`,
  ].join("\n");
  return waLink(GOODCANE_WHATSAPP, text);
}

/** GoodCane -> customer: confirmation note (business presses Send). */
export function confirmationText(o: {
  code: string;
  items: LineItem[];
  batchDate: string;
  fulfilmentLabel: string;
  customerName: string;
  total: number;
  status?: string;
}) {
  const largeFormat = o.items.some(
    (item) => item.productId.toLowerCase() === "tigernut" && (item.sizeId.toLowerCase() === "2l" || item.sizeId.toLowerCase() === "4l")
  );
  const paymentStatus =
    o.status === "paid"
      ? largeFormat
        ? `Deposit received toward ${cedis(o.total)}. The balance is due before collection.`
        : `Payment received. Total: ${cedis(o.total)}.`
      : `Total: ${cedis(o.total)}. Payment is due after this order is confirmed.`;

  return [
    `Hi ${o.customerName}, GoodCane here. Your pre-order ${o.code} is CONFIRMED for ${fmtBatch(o.batchDate)}.`,
    `Items: ${itemsText(o.items)}`,
    `Collection: ${o.fulfilmentLabel}`,
    paymentStatus,
    `Good Juice. Beautiful People.`,
  ].join("\n");
}

export function reminderText(message: string, origin: string) {
  return message.replace("[order link]", origin);
}

export { fmtCutoff };
