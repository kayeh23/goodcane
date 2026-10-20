"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DELIVERY_AREAS, DELIVERY_NOTE, PICKUP_POINTS, PRICE_NOTE, getProduct, getSize } from "@/lib/config";
import { fmtBatch, fmtCutoff } from "@/lib/dates";
import { cedis } from "@/lib/util";
import { CustomerHeader, DemoBanner, Dot } from "@/components/brand";
import { useBatch } from "@/components/batch";
import { api, useCart, useSavedPhone } from "@/components/client";
import { Stepper } from "@/components/stepper";

export default function Checkout() {
  const router = useRouter();
  const cart = useCart();
  const saved = useSavedPhone();
  const { data: batch } = useBatch();
  const [mode, setMode] = useState<"pickup" | "delivery">("pickup");
  const [pointId, setPointId] = useState("adenta");
  const [area, setArea] = useState("");
  const [landmark, setLandmark] = useState("");
  const [nameEdit, setName] = useState<string | null>(null);
  const [phoneEdit, setPhone] = useState<string | null>(null);
  const name = nameEdit ?? saved.name ?? "";
  const phone = phoneEdit ?? (saved.phone ? saved.phone : "");
  const [reminders, setReminders] = useState(false);
  const [weekly, setWeekly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const total = cart.lines.reduce((s, l) => s + l.qty * (getSize(l.productId, l.sizeId)?.price ?? 0), 0);
  const available = (id: string) => batch?.pickup.find((p) => p.id === id)?.available ?? true;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api<{ id: string }>("/api/orders", {
        body: {
          name,
          phone,
          items: cart.lines,
          fulfilment: mode === "pickup" ? { type: "pickup", pointId } : { type: "delivery", area, landmark },
          remindersOptIn: reminders,
          repeatWeekly: weekly,
        },
      });
      saved.save(phone.replace(/\D/g, ""), name.split(" ")[0] === "Sample" ? name : name.split(" ")[0]);
      cart.clear();
      router.push(`/order/${res.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  if (cart.ready && cart.lines.length === 0 && !busy)
    return (
      <div className="mx-auto max-w-md">
        <DemoBanner />
        <CustomerHeader />
        <div className="card mx-4 mt-6 p-6 text-center">
          <p className="font-semibold">Your pre-order is empty.</p>
          <Link href="/" className="btn-dark mt-4">
            Choose drinks
          </Link>
        </div>
      </div>
    );

  return (
    <div className="mx-auto max-w-md pb-10">
      <DemoBanner />
      <CustomerHeader />
      <form onSubmit={submit} className="space-y-5 px-4">
        <div>
          <Link href="/" className="text-sm font-semibold text-cane">
            ← Add more drinks
          </Link>
          <h1 className="mt-2 font-display text-[28px] font-bold leading-tight">Your pre-order</h1>
          {batch && (
            <p className="text-sm text-black/60">
              For the <b className="text-ink">{fmtBatch(batch.batchDate)}</b> batch · order by {fmtCutoff(batch.batchDate)}
            </p>
          )}
        </div>

        <section className="card divide-y divide-black/5">
          {cart.lines.map((l) => {
            const p = getProduct(l.productId)!;
            const s = getSize(l.productId, l.sizeId)!;
            return (
              <div key={`${l.productId}${l.sizeId}`} className="flex items-center gap-3 p-3">
                <Dot color={p.color} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-tight">{p.name}</p>
                  <p className="text-[13px] text-black/55">
                    {s.label} · {cedis(s.price)}
                  </p>
                </div>
                <Stepper label={`${p.name} ${s.label}`} qty={l.qty} onChange={(q) => cart.setQty(l.productId, l.sizeId, q)} />
              </div>
            );
          })}
          <div className="flex items-center justify-between p-3">
            <span className="text-sm font-semibold">Estimated total</span>
            <span className="font-bold">{cedis(total)}</span>
          </div>
          <p className="px-3 pb-3 text-[11px] text-black/50">{PRICE_NOTE}. Nothing is charged now.</p>
        </section>

        <section>
          <h2 className="label">How will you get it?</h2>
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-cream-2 p-1" role="radiogroup">
            {(["pickup", "delivery"] as const).map((m) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={`rounded-lg py-2 text-sm font-semibold ${mode === m ? "bg-white shadow-sm" : "text-black/60"}`}>
                {m === "pickup" ? "Pickup" : "Delivery (sample)"}
              </button>
            ))}
          </div>
          {mode === "pickup" ? (
            <div className="mt-3 space-y-2">
              {PICKUP_POINTS.map((p) => {
                const ok = available(p.id);
                return (
                  <label key={p.id} className={`card flex items-start gap-3 p-3 ${ok ? "cursor-pointer" : "opacity-55"} ${pointId === p.id && ok ? "border-cane ring-2 ring-cane/20" : ""}`}>
                    <input type="radio" name="point" className="mt-1 accent-cane" checked={pointId === p.id} disabled={!ok} onChange={() => setPointId(p.id)} />
                    <span>
                      <span className="block text-sm font-semibold">{p.name}</span>
                      <span className="text-[13px] text-black/55">{p.detail}</span>
                      {!ok && <span className="block text-[12px] font-semibold text-amber">Not open for this batch · {p.availabilityNote}</span>}
                    </span>
                  </label>
                );
              })}
              <p className="text-[11px] text-black/50">Pickup points from GoodCane&apos;s TikTok — times & days to confirm.</p>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <div>
                <label className="label" htmlFor="area">
                  Delivery area (sample, to confirm)
                </label>
                <select id="area" className="input" value={area} onChange={(e) => setArea(e.target.value)} required>
                  <option value="">Choose…</option>
                  {DELIVERY_AREAS.map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="landmark">
                  Nearest landmark <span className="font-normal text-black/50">(optional)</span>
                </label>
                <input id="landmark" className="input" maxLength={120} value={landmark} onChange={(e) => setLandmark(e.target.value)} placeholder="e.g. near the junction" />
              </div>
              <p className="rounded-xl bg-amber/10 p-3 text-[12px] text-amber">{DELIVERY_NOTE}</p>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="label !mb-0">Your details</h2>
          <div>
            <label className="label text-[13px] font-medium" htmlFor="name">
              Name
            </label>
            <input id="name" className="input" autoComplete="name" required minLength={2} maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="Sample Customer" />
          </div>
          <div>
            <label className="label text-[13px] font-medium" htmlFor="phone">
              Phone (WhatsApp or SMS)
            </label>
            <input id="phone" className="input" type="tel" inputMode="tel" autoComplete="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="020 000 0001" />
          </div>
        </section>

        <section className="space-y-2">
          <label className="card flex cursor-pointer items-start gap-3 p-3">
            <input type="checkbox" className="mt-1 size-4 accent-cane" checked={reminders} onChange={(e) => setReminders(e.target.checked)} />
            <span>
              <span className="block text-sm font-semibold">Remind me before next week&apos;s cutoff</span>
              <span className="text-[13px] text-black/55">Optional. At most one message a week, only after GoodCane approves it. Turn off any time in My orders or reply STOP.</span>
            </span>
          </label>
          <label className="card flex cursor-pointer items-start gap-3 p-3">
            <input type="checkbox" role="switch" className="mt-1 size-4 accent-cane" checked={weekly} onChange={(e) => setWeekly(e.target.checked)} />
            <span>
              <span className="block text-sm font-semibold">Repeat this order every week</span>
              <span className="text-[13px] text-black/55">A standing request: we&apos;ll request the same drinks for each batch. GoodCane confirms it weekly. Skip a week, pause or cancel any time.</span>
            </span>
          </label>
        </section>

        <section className="rounded-2xl bg-cream-2 p-4 text-[12.5px] leading-relaxed text-black/70">
          <p className="font-bold text-ink">Your privacy</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            <li>We only ask for your <b>name</b> (to label your bottles) and <b>phone</b> (to confirm your order and find it again).</li>
            <li>Reminders are opt-in — you&apos;re not signed up unless you tick the box.</li>
            <li>Cancel this request any time before the cutoff in <b>My orders</b>.</li>
            <li>No payment details are collected. Pay GoodCane after they confirm, as you do today (method to confirm).</li>
          </ul>
        </section>

        {error && (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy || cart.lines.length === 0} className="btn-dark w-full py-4 text-base">
          {busy ? "Sending…" : `Send pre-order request · ${cedis(total)}`}
        </button>
        <p className="text-center text-[12px] text-black/50">This is a request — it becomes an order when GoodCane confirms it.</p>
      </form>
    </div>
  );
}
