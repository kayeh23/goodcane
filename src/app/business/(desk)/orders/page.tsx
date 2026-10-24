"use client";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import type { DecoratedOrder } from "@/lib/analytics";
import { getProduct } from "@/lib/config";
import { fmtBatch, fmtDateTime } from "@/lib/dates";
import type { StandingOrder } from "@/lib/types";
import { cedis } from "@/lib/util";
import { confirmationText, waLink } from "@/lib/whatsapp";
import { Dot, StatusBadge } from "@/components/brand";
import { DeskQueryStatus, PageTitle, useAdmin } from "@/components/admin";
import { api } from "@/components/client";
import { WhatsAppLink } from "@/components/whatsapp-button";

type Resp = { batch: string; nextBatch: string; batches: string[]; orders: DecoratedOrder[]; standing: (StandingOrder & { customerName: string; customerPhone: string; skippingNext: boolean })[] };

export default function OrdersPage() {
  const sp = useSearchParams();
  const [batch, setBatch] = useState(sp.get("batch") ?? "");
  const [status, setStatus] = useState(sp.get("status") ?? "all");
  const [source, setSource] = useState("all");
  const [tab, setTab] = useState<"orders" | "standing">("orders");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const q = new URLSearchParams({ status, source, ...(batch ? { batch } : {}) }).toString();
  const { data, error, loading, reload } = useAdmin<Resp>(`/api/admin/orders?${q}`);

  const act = async (o: DecoratedOrder, action: string, label: string) => {
    let reason: string | undefined;
    if (action === "cancel") {
      const r = prompt(`Reason for cancelling ${o.code}? (shown to the customer)`, o.status === "requested" ? "Batch full this week" : "Cancelled by GoodCane");
      if (r === null) return;
      reason = r;
    }
    setBusy(o.id + action);
    try {
      await api(`/api/admin/orders/${o.id}`, { body: { action, reason } });
      if (action !== "notified") setMsg(`${o.code}: ${label}`);
      await reload();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const shown = data?.orders ?? [];
  const sel = "rounded-lg border border-black/15 bg-white px-2.5 py-2 text-sm";
  return (
    <>
      <PageTitle
        title="Orders"
        sub={data ? `${shown.length} shown · next batch ${fmtBatch(data.nextBatch)}` : "Staff order list for the selected batch."}
        right={
          <div className="flex rounded-xl bg-cream-2 p-1 text-sm">
            {(["orders", "standing"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-3 py-1.5 font-semibold ${tab === t ? "bg-white shadow-sm" : "text-black/55"}`}>
                {t === "orders" ? "Orders" : `Standing (${data?.standing.filter((s) => s.status !== "cancelled").length ?? "…"})`}
              </button>
            ))}
          </div>
        }
      />
      {msg && <p className="mb-3 rounded-xl border border-black/10 bg-white p-3 text-sm" role="status">{msg}</p>}
      <DeskQueryStatus
        loading={loading}
        error={error}
        hasData={!!data}
        emptyMessage="No orders in this store yet."
      />

      {data && tab === "orders" && (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <select aria-label="Batch" className={sel} value={batch || data?.batch || ""} onChange={(e) => setBatch(e.target.value)}>
              <option value="all">All batches</option>
              {data?.batches.map((b) => (
                <option key={b} value={b}>{fmtBatch(b)}{b === data.nextBatch ? " (next)" : ""}</option>
              ))}
            </select>
            <select aria-label="Status" className={sel} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="requested">Requests</option>
              <option value="confirmed">Confirmed (unpaid)</option>
              <option value="paid">Paid</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select aria-label="Source" className={sel} value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="all">All sources</option>
              <option value="web">New web order</option>
              <option value="reorder">Reorder</option>
              <option value="standing">Standing order</option>
            </select>
          </div>

          <div className="space-y-2">
            {shown.length === 0 && <p className="card p-6 text-center text-sm text-black/50">No orders match these filters.</p>}
            {shown.map((o) => (
              <div key={o.id} className="card grid gap-3 p-4 md:grid-cols-[1.1fr_1.3fr_auto] md:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <b>{o.code}</b>
                    <StatusBadge status={o.status} />
                    {o.standingOrderId && <span className="rounded-full bg-tan/25 px-2 py-0.5 text-[11px] font-semibold text-[#7a5631]">Standing</span>}
                    {o.source === "reorder" && <span className="rounded-full bg-lime/30 px-2 py-0.5 text-[11px] font-semibold text-cane-dark">Reorder</span>}
                    {o.reminderId && <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-semibold">After reminder</span>}
                  </div>
                  <p className="mt-1 text-sm">
                    {o.customerName} <span className="text-black/50">· {o.customerPhone}</span>
                    {o.returning && <span className="ml-1 text-[11px] font-semibold text-cane">returning</span>}
                  </p>
                  <p className="text-[12px] text-black/50">{fmtBatch(o.batchDate)} · {o.fulfilmentLabel} · created {fmtDateTime(o.createdAt)}</p>
                  {o.status === "cancelled" && <p className="text-[12px] text-red-700">Cancelled by {o.cancelledBy}: {o.cancelReason}</p>}
                </div>
                <div className="text-[13px]">
                  {o.items.map((i) => (
                    <p key={i.productId + i.sizeId} className="flex items-center gap-2">
                      <Dot color={getProduct(i.productId)?.color ?? "#ccc"} className="size-2" />
                      {i.qty}× {getProduct(i.productId)?.name} {i.sizeId}
                    </p>
                  ))}
                  <p className="mt-1 font-semibold">{cedis(o.total)} <span className="font-normal text-black/45">· {o.units} bottles</span></p>
                </div>
                <div className="flex flex-wrap gap-2 md:justify-end">
                  {o.status === "requested" && (
                    <>
                      <button className="btn-green" disabled={!!busy} onClick={() => act(o, "confirm", "confirmed")}>Confirm</button>
                      <button className="btn-danger" disabled={!!busy} onClick={() => act(o, "cancel", "declined")}>Decline</button>
                    </>
                  )}
                  {o.status === "confirmed" && (
                    <>
                      <button className="btn-dark" disabled={!!busy} onClick={() => act(o, "pay", "marked paid")}>Mark paid</button>
                      <button className="btn-danger" disabled={!!busy} onClick={() => act(o, "cancel", "cancelled")}>Cancel</button>
                    </>
                  )}
                  {(o.status === "confirmed" || o.status === "paid") && (
                    <WhatsAppLink className="px-3" href={waLink(o.customerPhone, confirmationText(o))} onOpen={() => act(o, "notified", "WhatsApp opened")}>
                      {o.notifiedAt ? "Notified ✓" : "Notify on WhatsApp"}
                    </WhatsAppLink>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-black/45">“Notify on WhatsApp” only opens WhatsApp with a prefilled message — you press Send. Sample phone numbers are fake placeholders. “Mark paid” is manual: no payment integration.</p>
        </>
      )}

      {data && tab === "standing" && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-cream-2/60 text-left text-[12px] text-black/55">
              <tr>
                <th className="px-4 py-2">Customer</th>
                <th className="px-2 py-2">Weekly items</th>
                <th className="px-2 py-2">Since</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-4 py-2">Next batch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {data?.standing.map((s) => (
                <tr key={s.id} className={s.status === "cancelled" ? "text-black/40" : ""}>
                  <td className="px-4 py-2">{s.customerName}<br /><span className="text-[12px] text-black/45">{s.customerPhone}</span></td>
                  <td className="px-2 py-2 text-[13px]">{s.items.map((i) => `${i.qty}× ${getProduct(i.productId)?.short} ${i.sizeId}`).join(", ")}</td>
                  <td className="px-2 py-2 text-[13px]">{fmtBatch(s.startBatch)}</td>
                  <td className="px-2 py-2"><StatusBadge status={s.status} /></td>
                  <td className="px-4 py-2 text-[13px]">{s.status !== "active" ? "—" : s.skippingNext ? "Skipping" : "Request created"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
