import { getSize } from "./config";
import type { LineItem, Order } from "./types";

export function normalisePhone(input: string): string | null {
  let d = (input || "").replace(/\D/g, "");
  if (d.startsWith("233") && d.length === 12) d = "0" + d.slice(3);
  if (d.length === 9 && !d.startsWith("0")) d = "0" + d;
  return /^0\d{9}$/.test(d) ? d : null;
}
export function fmtPhone(p: string) {
  return p.length === 10 ? `${p.slice(0, 3)} ${p.slice(3, 6)} ${p.slice(6)}` : p;
}
export function cedis(n: number) {
  return `GH₵${n.toLocaleString("en-GB")}`;
}
export function itemsTotal(items: LineItem[]) {
  return items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
}
export function unitsOf(items: LineItem[]) {
  return items.reduce((s, i) => s + i.qty, 0);
}
export function litresOf(items: LineItem[]) {
  return items.reduce((s, i) => s + (i.qty * (getSize(i.productId, i.sizeId)?.ml ?? 0)) / 1000, 0);
}
export function isFirm(o: Order) {
  return o.status === "confirmed" || o.status === "paid";
}
export function isLive(o: Order) {
  return o.status !== "cancelled";
}
export function skuKey(productId: string, sizeId: string) {
  return `${productId}|${sizeId}`;
}
export function newId(prefix: string) {
  const r = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `${prefix}_${r.replace(/-/g, "").slice(0, 12)}`;
}
