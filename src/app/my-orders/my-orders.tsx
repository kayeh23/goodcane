"use client";

import Link from "next/link";
import PhoneVerify from "@/components/phone-verify";
import { useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { getProduct, getSize } from "@/lib/config";
import { fmtBatch, fmtCutoff } from "@/lib/dates";
import type { Fulfilment, LineItem, OrderStatus, StandingOrder } from "@/lib/types";
import { cedis, fmtPhone, normalisePhone } from "@/lib/util";
import { CustomerHeader, DemoBanner, Dot, StatusBadge } from "@/components/brand";
import { api, useCart, useSavedPhone } from "@/components/client";

type LOrder = {
  id: string;
  code: string;
  status: OrderStatus;
  batchDate: string;
  items: LineItem[];
  total: number;
  fulfilmentLabel: string;
  fulfilment: Fulfilment;
  source: string;
  standingOrderId?: string;
  cancelReason?: string;
};
type LStanding = StandingOrder & { skippingNext: boolean };
type Lookup = {
  customer: { name: string; phone: string; remindersOptIn: boolean; sample: boolean } | null;
  orders: LOrder[];
  standing: LStanding[];
  batchDate: string;
};

type MyOrdersProps = {
  sessionPhone: string;
};

function Items({ items }: { items: LineItem[] }) {
  return (
    <ul className="space-y-0.5 text-[13px]">
      {items.map((i) => (
        <li key={i.productId + i.sizeId} className="flex items-center gap-2">
          <Dot color={getProduct(i.productId)?.color ?? "#ccc"} className="size-2" />
          <span>
            {i.qty}&times; {getProduct(i.productId)?.name}{" "}
            <span className="text-black/50">{getSize(i.productId, i.sizeId)?.label}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function ClientMyOrders({ sessionPhone }: MyOrdersProps) {
  const router = useRouter();
  const saved = useSavedPhone();
  const cart = useCart();
  const showPhoneVerify = sessionPhone === "";
  const [phoneEdit, setPhone] = useState<string | null>(null);
  const phone = phoneEdit ?? saved.phone ?? sessionPhone;
  const [data, setData] = useState<Lookup | null>(null);

  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async (p: string) => {
    setBusy("lookup");
    try {
      setData(await api<Lookup>("/api/lookup", { body: { phone: p } }));
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    if (!saved.ready || !saved.phone || data) return;
    let alive = true;
    api<Lookup>("/api/lookup", { body: { phone: saved.phone } })
      .then((r) => alive && setData(r))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [saved.ready, saved.phone, data]);

  useEffect(() => {
    if (data?.customer && saved.ready && saved.phone !== data.customer.phone)
      saved.save(data.customer.phone, data.customer.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.customer?.phone, saved.ready]);

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    setMsg(null);
    try {
      await fn();
      setMsg({ kind: "ok", text: ok });
      await load(phone);
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  async function reorder(o: LOrder) {
    setBusy("re" + o.id);
    setMsg(null);
    try {
      const res = await api<{ id: string }>(`/api/orders/${o.id}/reorder`, { body: { phone } });
      router.push(`/order/${res.id}`);
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.status === 409) {
        // e.g. usual pickup point closed this batch: prefill the cart and let them choose
        cart.replace(o.items.map(({ productId, sizeId, qty }) => ({ productId, sizeId, qty })));
        router.push("/checkout");
        return;
      }
      setMsg({ kind: "err", text: err.message });
      setBusy(null);
    }
  }

  const B = data?.batchDate;
  const thisBatch =
    data?.orders.filter((o) => o.batchDate === B && o.status !== "cancelled") ?? [];
  const last =
    data?.orders.find((o) => o.status !== "cancelled" && o.batchDate !== B) ??
    data?.orders.find((o) => o.status !== "cancelled");

  return (
    <div className="mx-auto max-w-md pb-12">
      <DemoBanner />
      <CustomerHeader right={<Link href="/" className="text-sm font-semibold text-cane">Shop</Link>} />
      <main className="space-y-4 px-4">
        <h1 className="font-display text-[28px] font-bold leading-tight">My orders</h1>

        {showPhoneVerify ? (
          <PhoneVerify
            phoneLabel="Your phone number"
            phoneHelp="We'll send a 4-digit code by SMS. Ghana numbers only — 024 123 4567 or +233 24 123 4567."
            showSignOut
            refreshUrl="/api/lookup"
          />
        ) : !data?.customer && (
          <form
            className="card space-y-3 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              const p = normalisePhone(phone);
              if (!p) return setMsg({ kind: "err", text: "Enter a valid Ghana number, e.g. 020 000 0001." });
              setPhone(p);
              setMsg(null);
              load(p);
            }}
          >
            <label className="label" htmlFor="lookup-phone">
              Your phone number
            </label>
            <input
              id="lookup-phone"
              className="input"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="020 000 0001"
            />
            <button className="btn-dark w-full py-3" disabled={busy === "lookup"}>
              {busy === "lookup" ? "Looking up\u2026" : "Find my orders"}
            </button>
            <p className="text-[12px] text-black/50">
              Demo tip: try a sample number like 020 000 0001 (has a standing order) or 020 000
              0010. Prototype only — a real pilot would verify the number with a one-time SMS code.
            </p>
            {data && !data.customer && (
              <p className="text-sm text-black/70">
                No orders found for {fmtPhone(normalisePhone(phone) ?? phone)} yet.
              </p>
            )}
          </form>
        )}

        {msg && (
          <p
            role="status"
            className={`rounded-xl border p-3 text-sm ${
              msg.kind === "ok"
                ? "border-green-200 bg-green-50 text-green-900"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {msg.text}
          </p>
        )}

        {data?.customer && B && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm">
                Hi <b>{data.customer.name}</b> &middot; {fmtPhone(data.customer.phone)}
                {data.customer.sample && <span className="pill-sample ml-2">Sample</span>}
              </p>
              <button
                className="text-[13px] font-semibold text-black/50 underline"
                onClick={() => {
                  saved.forget();
                  setData(null);
                  setPhone("");
                }}
              >
                Not you?
              </button>
            </div>

            <section className="rounded-3xl bg-ink p-5 text-white">
              <p className="text-xs font-bold tracking-[0.14em] text-lime uppercase">
                Next batch &middot; {fmtBatch(B)}
              </p>
              {thisBatch.length > 0 ? (
                <>
                  <p className="mt-1 font-display text-xl font-bold">You&apos;re on the list &#10003;</p>
                  <p className="text-sm text-white/70">
                    {thisBatch.length} order{thisBatch.length > 1 ? "s" : ""} for this batch
                    &middot; order more by {fmtCutoff(B)}
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-1 font-display text-xl font-bold">
                    Your usual for {fmtBatch(B)}?
                  </p>
                  <p className="text-sm text-white/70">Order by {fmtCutoff(B)}</p>
                </>
              )}
              {last && (
                <button
                  onClick={() => reorder(last)}
                  disabled={!!busy}
                  className="btn mt-4 w-full bg-lime py-3.5 text-base text-ink hover:bg-lime/90"
                >
                  {busy === "re" + last.id
                    ? "Reordering\u2026"
                    : `Reorder ${last.items.reduce((s, i) => s + i.qty, 0)} items \u00b7 ${cedis(last.total)}`}
                </button>
              )}
              {last && (
                <p className="mt-2 text-center text-[12px] text-white/55">
                  Same drinks &amp; {last.fulfilmentLabel.replace("Pickup \u00b7 ", "pickup at ")}
                </p>
              )}
            </section>

            {data.standing.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-sm font-bold">Weekly standing order</h2>
                {data.standing.map((s) => (
                  <div key={s.id} className="card space-y-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <Items items={s.items} />
                      <StatusBadge status={s.status} />
                    </div>
                    <p className="text-[13px] text-black/60">
                      {s.status === "paused"
                        ? "Paused — no requests are created until you resume."
                        : s.skippingNext
                        ? `Skipping ${fmtBatch(B)}. Back the week after.`
                        : `Included in ${fmtBatch(B)} — GoodCane confirms it each week.`}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {s.status === "active" &&
                        (s.skippingNext ? (
                          <button
                            className="btn-ghost"
                            disabled={!!busy}
                            onClick={() =>
                              run(
                                "s" + s.id,
                                () =>
                                  api(`/api/standing/${s.id}`, {
                                    body: { phone, action: "unskip" },
                                  }),
                                "You're back in this week's batch.",
                              )
                            }
                          >
                            Undo skip
                          </button>
                        ) : (
                          <button
                            className="btn-ghost"
                            disabled={!!busy}
                            onClick={() =>
                              run(
                                "s" + s.id,
                                () =>
                                  api(`/api/standing/${s.id}`, {
                                    body: { phone, action: "skip" },
                                  }),
                                `Skipped ${fmtBatch(B)}.`,
                              )
                            }
                          >
                            Skip this week
                          </button>
                        ))}
                      {s.status === "active" && (
                        <button
                          className="btn-ghost"
                          disabled={!!busy}
                          onClick={() =>
                            run(
                              "s" + s.id,
                              () =>
                                api(`/api/standing/${s.id}`, {
                                  body: { phone, action: "pause" },
                                }),
                              "Standing order paused.",
                            )
                          }
                        >
                          Pause
                        </button>
                      )}
                      {s.status === "paused" && (
                        <button
                          className="btn-green"
                          disabled={!!busy}
                          onClick={() =>
                            run(
                              "s" + s.id,
                              () =>
                                api(`/api/standing/${s.id}`, {
                                  body: { phone, action: "resume" },
                                }),
                              "Standing order resumed.",
                            )
                          }
                        >
                          Resume
                        </button>
                      )}
                      <button
                        className="btn-danger"
                        disabled={!!busy}
                        onClick={() => {
                          if (
                            confirm(
                              "Cancel your weekly standing order? Past orders are not affected.",
                            )
                          )
                            run(
                              "s" + s.id,
                              () =>
                                api(`/api/standing/${s.id}`, {
                                  body: { phone, action: "cancel" },
                                }),
                              "Standing order cancelled.",
                            );
                        }}
                      >
                        Cancel standing order
                      </button>
                    </div>
                  </div>
                ))}
              </section>
            )}

            <section className="card flex items-center justify-between gap-3 p-4">
              <span>
                <span className="block text-sm font-semibold">Weekly reminders</span>
                <span className="text-[13px] text-black/55">
                  {data.customer.remindersOptIn
                    ? "On — one message before the cutoff, sent by GoodCane."
                    : "Off. Turn on to get a nudge before each cutoff."}
                </span>
              </span>
              <button
                role="switch"
                aria-checked={data.customer.remindersOptIn}
                aria-label="Weekly reminders"
                disabled={!!busy}
                onClick={() =>
                  run(
                    "rem",
                    () =>
                      api("/api/reminders/preferences", {
                        body: { phone, optIn: !data.customer!.remindersOptIn },
                      }),
                    data.customer!.remindersOptIn
                      ? "Reminders turned off."
                      : "Reminders turned on.",
                  )
                }
                className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                  data.customer.remindersOptIn ? "bg-cane" : "bg-black/20"
                }`}
              >
                <span
                  className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition ${
                    data.customer.remindersOptIn ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-bold">Orders</h2>
              {data.orders.map((o) => (
                <div key={o.id} className="card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">
                        {fmtBatch(o.batchDate)}{" "}
                        <span className="font-normal text-black/45">&middot; {o.code}</span>
                      </p>
                      <p className="text-[12px] text-black/50">
                        {o.fulfilmentLabel}
                        {o.standingOrderId ? " \u00b7 weekly" : ""}
                      </p>
                    </div>
                    <StatusBadge status={o.status} />
                  </div>
                  <div className="mt-2 flex items-end justify-between gap-2">
                    <Items items={o.items} />
                    <span className="text-sm font-semibold">{cedis(o.total)}</span>
                  </div>
                  {o.cancelReason && o.status === "cancelled" && (
                    <p className="mt-1 text-[12px] text-black/50">{o.cancelReason}</p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <button
                      className="btn-outline flex-1"
                      disabled={!!busy}
                      onClick={() => reorder(o)}
                    >
                      {busy === "re" + o.id ? "\u2026" : "Reorder"}
                    </button>
                    <Link href={`/order/${o.id}`} className="btn-ghost">
                      Details
                    </Link>
                    {o.batchDate === B &&
                      (o.status === "requested" || o.status === "confirmed") && (
                        <button
                          className="btn-danger"
                          disabled={!!busy}
                          onClick={() => {
                            if (confirm(`Cancel order ${o.code}?`))
                              run(
                                "c" + o.id,
                                () =>
                                  api(`/api/orders/${o.id}/cancel`, { body: { phone } }),
                                `Order ${o.code} cancelled.`,
                              );
                          }}
                        >
                          Cancel
                        </button>
                      )}
                  </div>
                </div>
              ))}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

const ClientMyOrdersWithSession = ({ sessionPhone }: { sessionPhone: string }) => {
  return (
    <Suspense fallback={null}>
      <ClientMyOrders sessionPhone={sessionPhone} />
    </Suspense>
  );
};

export { ClientMyOrdersWithSession as default };
