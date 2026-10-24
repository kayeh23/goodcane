"use client";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { WHATSAPP_IS_PLACEHOLDER, getProduct, getSize } from "@/lib/config";
import { fmtBatch, fmtCutoff, fmtDateTime } from "@/lib/dates";
import type { LineItem, OrderEvent, OrderStatus } from "@/lib/types";
import { calculatePaymentAmount } from "@/lib/services/payments";
import { cedis } from "@/lib/util";
import { orderToBusinessLink } from "@/lib/whatsapp";
import { CustomerHeader, DemoBanner, Dot, StatusBadge } from "@/components/brand";
import { useApi } from "@/components/client";
import { PaymentButton } from "@/components/payment-button";
import { WhatsAppLink } from "@/components/whatsapp-button";

type OrderView = {
  id: string; code: string; status: OrderStatus; batchDate: string; items: LineItem[]; total: number; fulfilmentLabel: string;
  events: OrderEvent[]; cancelReason?: string; firstName: string; remindersOptIn: boolean; standing: { status: string } | null; sample: boolean;
};

const STEPS: { key: OrderStatus; title: string; text: string }[] = [
  { key: "requested", title: "Request sent", text: "GoodCane checks the batch and confirms." },
  { key: "confirmed", title: "Confirmed", text: "Your bottles are reserved in this batch." },
  { key: "paid", title: "Paid", text: "Mobile Money or the batch desk marks the order paid." },
];

export default function OrderStatusView() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { data: o, error, loading, reload } = useApi<OrderView>(`/api/orders/${id}`);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const simPosted = useRef(false);
  const idx = o ? STEPS.findIndex((s) => s.key === o.status) : -1;
  const payment = o ? calculatePaymentAmount(o.items) : null;
  const isSimulated = searchParams.get("simulated_payment") === "success";
  const paymentRef = searchParams.get("reference") || searchParams.get("trxref");

  useEffect(() => {
    if (!o || o.status !== "confirmed") return;
    const interval = setInterval(() => {
      void reload();
    }, 4000);
    return () => clearInterval(interval);
  }, [o, reload]);

  useEffect(() => {
    if (!isSimulated || !o || o.status !== "confirmed" || !payment || simPosted.current) return;
    const reference = paymentRef?.startsWith("sim_") ? paymentRef : `sim_${o.code}_${Date.now()}`;
    const deposit = payment.isDeposit;
    const pesewas = payment.payablePesewas;
    const orderId = o.id;
    const orderCode = o.code;
    simPosted.current = true;
    void fetch("/api/webhooks/paystack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "charge.success",
        data: {
          reference,
          status: "success",
          amount: pesewas,
          currency: "GHS",
          channel: "mobile_money",
          metadata: { orderId, orderCode },
        },
      }),
    })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as { applied?: boolean; reason?: string };
        if (res.ok && body.applied) {
          setToastMessage(deposit ? "Deposit received. The balance is still due before collection." : "Payment received. This order is paid.");
        } else {
          setToastMessage(body.reason || "Payment could not be recorded.");
        }
        await reload();
      })
      .catch(() => setToastMessage("Payment could not be recorded."));
  }, [isSimulated, o, payment, paymentRef, reload]);

  return (
    <div className="mx-auto max-w-md pb-10">
      <DemoBanner />
      <CustomerHeader />
      <main className="space-y-4 px-4">
        {loading && !o && <p className="card p-6 text-center text-sm text-black/60">Loading…</p>}
        {error && <p className="card p-6 text-center text-sm text-red-700">{error.message}</p>}
        {toastMessage && <p className="card p-4 text-center text-sm">{toastMessage}</p>}
        {o && (
          <>
            <section className="rounded-3xl bg-ink p-5 text-white">
              <p className="text-xs font-bold tracking-[0.14em] text-lime uppercase">{o.status === "cancelled" ? "Cancelled" : o.status === "requested" ? "Request received" : "You're in the batch"}</p>
              <h1 className="mt-1 font-display text-[28px] font-bold leading-tight">
                {o.status === "cancelled" ? "This order was cancelled" : o.status === "paid" ? `You're all set, ${o.firstName}!` : `Thanks, ${o.firstName}!`}
              </h1>
              <p className="mt-1 text-sm text-white/75">
                Ref <b className="text-white">{o.code}</b> · {fmtBatch(o.batchDate)} batch
              </p>
              {o.sample && <span className="mt-2 inline-block rounded bg-white/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-lime uppercase">Sample order</span>}
            </section>

            {o.status !== "cancelled" ? (
              <ol className="card p-4">
                {STEPS.map((s, i) => (
                  <li key={s.key} className="flex gap-3 pb-3 last:pb-0">
                    <span className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i <= idx ? "bg-cane text-white" : "bg-black/10 text-black/40"}`}>{i < idx || (i === idx && i === 2) ? "✓" : i + 1}</span>
                    <span>
                      <span className={`block text-sm font-semibold ${i <= idx ? "" : "text-black/45"}`}>{s.title}</span>
                      <span className="text-[13px] text-black/55">{s.text}</span>
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="card p-4 text-sm text-black/70">{o.cancelReason ?? "Cancelled."}</p>
            )}

            {o.status === "confirmed" && payment && (
              <section className="card space-y-3 p-4">
                <h2 className="text-base font-bold">Pay with Mobile Money (GH₵)</h2>
                <p className="text-[13px] text-black/60">
                  {payment.isDeposit
                    ? `Tigernut 2L or 4L needs a 50% deposit of ${cedis(payment.payableInCedis)} now. The rest of the ${cedis(payment.totalInCedis)} total is due before collection.`
                    : "Pay with MTN MoMo, Telecel Cash, or card. This order is already confirmed."}
                </p>
                {paymentRef && !isSimulated && <p className="text-[13px] text-black/60">Waiting for Paystack to confirm this payment.</p>}
                <PaymentButton orderId={o.id} orderCode={o.code} amountInCedis={payment.payableInCedis} isDeposit={payment.isDeposit} />
              </section>
            )}

            {o.status === "paid" && payment && (
              <section className="card p-4">
                <p className="text-sm font-semibold">{payment.isDeposit ? "Deposit received" : "Payment received"}</p>
                <p className="mt-1 text-[13px] text-black/60">
                  {payment.isDeposit
                    ? `The balance of this ${cedis(payment.totalInCedis)} order is still due before collection at ${o.fulfilmentLabel}.`
                    : `This order is paid in full for ${o.fulfilmentLabel} on ${fmtBatch(o.batchDate)}.`}
                </p>
              </section>
            )}

            {o.status !== "cancelled" && (
              <section className="card space-y-2 p-4">
                <p className="text-sm font-semibold">Let GoodCane know on WhatsApp <span className="font-normal text-black/50">(optional)</span></p>
                <p className="text-[13px] text-black/55">Opens WhatsApp with your order details filled in — you press Send. Nothing is sent automatically.</p>
                <WhatsAppLink className="w-full py-3" href={orderToBusinessLink({ code: o.code, items: o.items, batchDate: o.batchDate, fulfilmentLabel: o.fulfilmentLabel, name: o.firstName, total: o.total })}>
                  Send to GoodCane on WhatsApp
                </WhatsAppLink>
                {WHATSAPP_IS_PLACEHOLDER && <p className="text-[11px] text-amber">Prototype: uses a placeholder business number (233000000000) until GoodCane approves.</p>}
              </section>
            )}

            <section className="card divide-y divide-black/5">
              {o.items.map((i) => (
                <div key={i.productId + i.sizeId} className="flex items-center gap-3 p-3 text-sm">
                  <Dot color={getProduct(i.productId)?.color ?? "#ccc"} />
                  <span className="flex-1">
                    {getProduct(i.productId)?.name} <span className="text-black/50">{getSize(i.productId, i.sizeId)?.label}</span>
                  </span>
                  <span className="font-semibold">×{i.qty}</span>
                </div>
              ))}
              <div className="flex justify-between p-3 text-sm">
                <span>{o.fulfilmentLabel}</span>
                <b>{cedis(o.total)}</b>
              </div>
              <div className="flex flex-wrap gap-2 p-3 text-[12px] text-black/60">
                <StatusBadge status={o.status} />
                {o.standing && <span className="rounded-full bg-lime/30 px-2 py-0.5 font-semibold text-cane-dark">Repeats weekly · {o.standing.status}</span>}
                {o.remindersOptIn && <span className="rounded-full bg-black/5 px-2 py-0.5 font-semibold">Reminders on</span>}
              </div>
            </section>

            {o.status === "requested" && (
              <p className="px-1 text-[13px] text-black/60">
                Change of plans? You can cancel in <b>My orders</b> until {fmtCutoff(o.batchDate)}.
              </p>
            )}

            <details className="card p-4 text-[13px]">
              <summary className="cursor-pointer font-semibold">Order history</summary>
              <ul className="mt-2 space-y-1 text-black/60">
                {o.events.map((e, i) => (
                  <li key={i}>
                    {fmtDateTime(e.at)} — {e.status === "created" ? "request created" : e.status} by {e.by}
                    {e.note ? ` · ${e.note}` : ""}
                  </li>
                ))}
              </ul>
            </details>

            <div className="grid grid-cols-2 gap-2">
              <Link href="/my-orders" className="btn-dark py-3">
                My orders
              </Link>
              <Link href="/" className="btn-ghost py-3">
                Back to shop
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
