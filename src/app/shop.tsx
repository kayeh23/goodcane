"use client";
import Image from "next/image";
import Link from "next/link";
import { BRAND, PRICE_NOTE, PRODUCTS, getSize } from "@/lib/config";
import { fmtBatch, fmtCutoff } from "@/lib/dates";
import { cedis } from "@/lib/util";
import { CustomerHeader, DemoBanner, Dot } from "@/components/brand";
import { useBatch, useCountdown } from "@/components/batch";
import { useCart, useSavedPhone } from "@/components/client";
import { Stepper } from "@/components/stepper";

export default function Shop() {
  const { data: batch } = useBatch();
  const cd = useCountdown(batch?.cutoff);
  const cart = useCart();
  const saved = useSavedPhone();
  const count = cart.lines.reduce((s, l) => s + l.qty, 0);
  const total = cart.lines.reduce((s, l) => s + l.qty * (getSize(l.productId, l.sizeId)?.price ?? 0), 0);

  return (
    <div className="mx-auto max-w-md pb-32">
      <DemoBanner />
      <CustomerHeader />

      <section className="mx-4 overflow-hidden rounded-3xl bg-ink text-white">
        <div className="relative aspect-[16/8]">
          <Image src="/products/hero_four.jpg" alt="Four GoodCane sugarcane juice bottles on sugarcane stalks" fill priority sizes="(max-width: 448px) 100vw, 448px" className="object-cover object-[center_40%]" />
          <span className="absolute right-2 bottom-2 rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white/85">Photo: GoodCane TikTok</span>
        </div>
        <div className="p-5">
          <p className="text-xs font-bold tracking-[0.14em] text-lime uppercase">{BRAND.tagline}</p>
          <h1 className="mt-2 font-display text-[28px] leading-tight font-bold">
            Next fresh batch: {batch ? fmtBatch(batch.batchDate) : "…"}
          </h1>
          <p className="mt-2 text-[15px] text-white/80">Pressed fresh weekly. Pre-order so we press enough for you — no waste, no sold-out.</p>
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">Order by {batch ? fmtCutoff(batch.batchDate) : "…"}</p>
            {cd && (
              <div className="flex gap-1.5" aria-label="Time left to order">
                {[["d", cd.d], ["h", cd.h], ["m", cd.m]].map(([u, v]) => (
                  <span key={u as string} className="rounded-lg bg-white/10 px-2 py-1 text-sm font-bold text-lime tabular-nums">
                    {v}
                    <span className="text-[10px] text-white/60">{u}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
          <p className="mt-3 text-[11px] text-white/50">Batch day & cutoff are prototype assumptions — to confirm with GoodCane.</p>
        </div>
      </section>

      <ol className="mx-4 mt-4 grid grid-cols-3 gap-2 text-center text-[12px] leading-tight">
        {[["1", "Pre-order", "before the cutoff"], ["2", "GoodCane confirms", "your request"], ["3", "Pay & collect", "on batch day"]].map(([n, a, b]) => (
          <li key={n} className="card px-2 py-3">
            <span className="mx-auto mb-1 flex size-6 items-center justify-center rounded-full bg-lime text-xs font-bold">{n}</span>
            <span className="block font-semibold">{a}</span>
            <span className="text-black/55">{b}</span>
          </li>
        ))}
      </ol>

      {saved.ready && saved.phone && (
        <Link href="/my-orders" className="mx-4 mt-4 flex items-center justify-between rounded-2xl border border-cane/30 bg-cane/5 px-4 py-3">
          <span>
            <span className="block text-sm font-bold text-cane">Welcome back{saved.name ? `, ${saved.name}` : ""}</span>
            <span className="text-[13px] text-black/60">Reorder your usual in one tap</span>
          </span>
          <span className="text-cane">→</span>
        </Link>
      )}

      <section className="mt-6 px-4">
        <h2 className="font-display text-2xl font-bold">This week&apos;s drinks</h2>
        <p className="mt-0.5 text-[13px] text-black/55">{PRICE_NOTE} · no additives or preservatives</p>
        <ul className="mt-3 space-y-3">
          {PRODUCTS.map((p) => (
            <li key={p.id} className="card p-3">
              <div className="flex items-center gap-3">
                <div className="relative size-16 shrink-0 overflow-hidden rounded-xl" style={{ background: p.color }}>
                  <Image src={p.image} alt={`${p.name} bottle`} fill sizes="64px" className="object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-semibold leading-tight">
                    <Dot color={p.color} /> {p.name}
                  </p>
                  {p.sizes.length === 1 ? (
                    <p className="mt-0.5 text-[13px] text-black/60">
                      {p.sizes[0].label} · {cedis(p.sizes[0].price)}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-[13px] text-black/60">
                      <span className="rounded bg-tan/20 px-1.5 py-0.5 text-[11px] font-semibold text-[#7a5631]">Made to order</span> · pre-order only
                    </p>
                  )}
                </div>
                {p.sizes.length === 1 && <Stepper label={p.name} qty={cart.qtyOf(p.id, p.sizes[0].id)} onChange={(q) => cart.setQty(p.id, p.sizes[0].id, q)} />}
              </div>
              {p.sizes.length > 1 && (
                <ul className="mt-3 divide-y divide-black/5 rounded-xl bg-cream/70">
                  {p.sizes.map((s) => (
                    <li key={s.id} className="flex items-center justify-between px-3 py-2">
                      <span className="text-sm">
                        <span className="font-semibold">{s.label}</span> <span className="text-black/60">· {cedis(s.price)}</span>
                      </span>
                      <Stepper label={`${p.name} ${s.label}`} qty={cart.qtyOf(p.id, s.id)} onChange={(q) => cart.setQty(p.id, s.id, q)} />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-8 space-y-2 px-5 text-center text-[12px] text-black/50">
        <p>
          Brand, product names, photos & prices from{" "}
          <a className="underline" href={BRAND.tiktok} target="_blank" rel="noreferrer">
            GoodCane on TikTok ({BRAND.tiktokHandle})
          </a>
          . Prototype — all customers & orders are sample data.
        </p>
        <p>
          <Link href="/business" className="font-semibold text-cane underline">
            GoodCane business view →
          </Link>
        </p>
      </footer>

      {cart.ready && count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-black/10 bg-cream/95 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),12px)] backdrop-blur">
          <Link href="/checkout" className="btn-dark mx-auto flex w-full max-w-md py-4 text-base">
            Review pre-order · {count} item{count === 1 ? "" : "s"} · {cedis(total)}
          </Link>
        </div>
      )}
    </div>
  );
}
