"use client";
import Link from "next/link";
import { useState } from "react";
import type { overview } from "@/lib/analytics";
import { fmtBatch, fmtCutoff } from "@/lib/dates";
import { Dot } from "@/components/brand";
import { Kpi, PageTitle, useAdmin } from "@/components/admin";
import { api } from "@/components/client";

type Overview = ReturnType<typeof overview> & { storage: string; seededAt: string };

export default function OverviewPage() {
  const { data: d, reload } = useAdmin<Overview>("/api/admin/overview");
  const [resetting, setResetting] = useState(false);
  if (!d) return <p className="text-sm text-black/50">Loading…</p>;
  const total = d.rows.reduce((s, r) => ({ requested: s.requested + r.requested, confirmed: s.confirmed + r.confirmed, paid: s.paid + r.paid }), { requested: 0, confirmed: 0, paid: 0 });
  const maxRow = Math.max(1, ...d.rows.map((r) => r.requested + r.confirmed + r.paid));
  const maxOut = Math.max(1, ...d.outlook.map((w) => w.total));

  return (
    <>
      <PageTitle
        title="Next batch demand"
        sub={`What to press for ${fmtBatch(d.batchDate)} — requests vs confirmed vs paid`}
        right={
          <>
            <span className="pill-sample">Sample data</span>
            <span className="rounded-xl bg-ink px-3 py-2 text-[13px] font-semibold text-white">Cutoff {fmtCutoff(d.batchDate)}</span>
            <a href={`/api/admin/export?batch=${d.batchDate}`} className="btn-ghost" download>
              Export CSV
            </a>
            <button
              className="btn-ghost"
              disabled={resetting}
              onClick={async () => {
                if (!confirm("Reset all demo data back to the sample seed? Orders placed during the demo will be removed.")) return;
                setResetting(true);
                await api("/api/admin/reset", { method: "POST" });
                await reload();
                setResetting(false);
              }}
            >
              {resetting ? "Resetting…" : "Reset demo data"}
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi tone="amber" label="Requests" value={`${d.counts.requested} orders`} sub={`${d.units.requested} bottles awaiting your confirmation`} />
        <Kpi tone="sky" label="Confirmed · unpaid" value={`${d.counts.confirmed} orders`} sub={`${d.units.confirmed} bottles · accepted by you`} />
        <Kpi tone="green" label="Paid" value={`${d.counts.paid} orders`} sub={`${d.units.paid} bottles · marked paid manually`} />
        <Kpi tone="tan" label="Standing orders" value={`${d.standing.active} active`} sub={`${d.standing.confirmedThis} confirmed this batch · ${d.standing.awaitingThis} to confirm · ${d.standing.paused} paused`} />
        <Kpi tone="red" label="Cancellations" value={`${d.counts.cancelled} orders`} sub={`${d.units.cancelled} bottles this batch`} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_300px]">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <h2 className="font-bold">Demand by product & size (bottles)</h2>
            <span className="text-[12px] font-semibold text-cane">Firm = Confirmed + Paid</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="bg-cream-2/60 text-left text-[12px] text-black/55">
                <tr>
                  <th className="px-4 py-2 font-semibold">Product</th>
                  <th className="px-2 py-2 font-semibold">Size</th>
                  <th className="px-2 py-2 text-right font-semibold text-amber">Requested</th>
                  <th className="px-2 py-2 text-right font-semibold text-sky-800">Confirmed</th>
                  <th className="px-2 py-2 text-right font-semibold text-cane">Paid</th>
                  <th className="px-2 py-2 text-right font-semibold">Firm</th>
                  <th className="px-4 py-2 font-semibold">Firm vs pending</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {d.rows.map((r) => (
                  <tr key={r.key}>
                    <td className="px-4 py-2">
                      <span className="flex items-center gap-2">
                        <Dot color={r.color} /> {r.name}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-black/60">{r.size}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-amber">{r.requested}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-sky-800">{r.confirmed}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-cane">{r.paid}</td>
                    <td className="px-2 py-2 text-right font-bold tabular-nums">{r.confirmed + r.paid}</td>
                    <td className="px-4 py-2">
                      <div className="flex h-2.5 w-full max-w-40 overflow-hidden rounded-full bg-black/5">
                        <div className="bg-cane" style={{ width: `${((r.confirmed + r.paid) / maxRow) * 100}%` }} />
                        <div className="bg-tan/70" style={{ width: `${(r.requested / maxRow) * 100}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
                <tr className="bg-cream-2/40 font-bold">
                  <td className="px-4 py-2">Total</td>
                  <td />
                  <td className="px-2 py-2 text-right text-amber">{total.requested}</td>
                  <td className="px-2 py-2 text-right text-sky-800">{total.confirmed}</td>
                  <td className="px-2 py-2 text-right text-cane">{total.paid}</td>
                  <td className="px-2 py-2 text-right">{total.confirmed + total.paid}</td>
                  <td className="px-4 py-2 text-[12px] font-normal text-black/50">+{total.requested} pending</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <div className="space-y-5">
          <section className="card p-4 text-sm">
            <h2 className="font-bold">Prep plan (firm orders)</h2>
            <dl className="mt-3 space-y-2">
              <div className="flex justify-between"><dt className="text-black/60">Sugarcane juices</dt><dd className="font-bold">≈ {d.prep.sugarcaneLitres.toFixed(1)} L</dd></div>
              <div className="flex justify-between"><dt className="text-black/60">Tigernut-Coconut</dt><dd className="font-bold">≈ {d.prep.tigernutLitres.toFixed(1)} L</dd></div>
              <div className="flex justify-between border-t border-black/5 pt-2"><dt className="text-black/60">If all requests confirm</dt><dd className="font-bold text-amber">+ {d.prep.pendingLitres.toFixed(1)} L</dd></div>
            </dl>
            <p className="mt-2 text-[11px] text-black/45">Bottle sizes × firm bottles. Yields, shelf life and capacity to confirm with GoodCane.</p>
          </section>
          <section className="card p-4 text-sm">
            <h2 className="font-bold">Standing orders</h2>
            <dl className="mt-3 space-y-1.5">
              <div className="flex justify-between"><dt className="text-black/60">Active</dt><dd className="font-bold">{d.standing.active}</dd></div>
              <div className="flex justify-between"><dt className="text-black/60">Confirmed for {fmtBatch(d.batchDate)}</dt><dd className="font-bold">{d.standing.confirmedThis}</dd></div>
              <div className="flex justify-between"><dt className="text-black/60">Awaiting confirmation</dt><dd className="font-bold text-amber">{d.standing.awaitingThis}</dd></div>
              <div className="flex justify-between"><dt className="text-black/60">Skipping this week</dt><dd className="font-bold">{d.standing.skippingThis}</dd></div>
              <div className="flex justify-between"><dt className="text-black/60">Paused</dt><dd className="font-bold">{d.standing.paused}</dd></div>
            </dl>
            <Link href="/business/orders?status=requested" className="btn-dark mt-3 w-full">Review requests</Link>
          </section>
          <Link href="/business/reminders" className="card flex items-center justify-between p-4 text-sm">
            <span><b>{d.pendingReminders}</b> reminder{d.pendingReminders === 1 ? "" : "s"} waiting for approval</span>
            <span className="text-cane">→</span>
          </Link>
        </div>
      </div>

      <section className="card mt-5 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-bold">Upcoming demand — next {d.outlook.length} batches (bottles)</h2>
            <p className="max-w-2xl text-[12px] text-black/55">Method: {d.method}. Future batches are estimates, not orders.</p>
          </div>
          <div className="flex flex-wrap gap-3 text-[11px] text-black/60">
            <span className="flex items-center gap-1"><i className="size-2.5 rounded-sm bg-cane" />Firm</span>
            <span className="flex items-center gap-1"><i className="size-2.5 rounded-sm bg-amber" />Pending requests</span>
            <span className="flex items-center gap-1"><i className="size-2.5 rounded-sm bg-tan" />Standing (expected)</span>
            <span className="flex items-center gap-1"><i className="size-2.5 rounded-sm border border-dashed border-black/40 bg-black/5" />Forecast one-off</span>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-4 items-end gap-3 sm:gap-6" style={{ height: 200 }}>
          {d.outlook.map((w) => {
            const seg = (n: number) => `${(n / maxOut) * 160}px`;
            return (
              <div key={w.batchDate} className="flex h-full flex-col justify-end text-center">
                <p className="mb-1 text-sm font-bold">{w.kind === "forecast" ? "~" : ""}{w.total}</p>
                <div className="flex flex-col overflow-hidden rounded-t-lg">
                  {w.kind === "orders" ? (
                    <>
                      <div className="bg-amber" style={{ height: seg(w.pending) }} title={`${w.pending} pending`} />
                      <div className="bg-cane" style={{ height: seg(w.firm) }} title={`${w.firm} firm`} />
                    </>
                  ) : (
                    <>
                      <div className="border border-dashed border-black/35 bg-black/5" style={{ height: seg(w.oneOff) }} title={`${w.oneOff} one-off forecast`} />
                      <div className="bg-tan" style={{ height: seg(w.standing) }} title={`${w.standing} standing`} />
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-2 grid grid-cols-4 gap-3 text-center text-[12px] text-black/60 sm:gap-6">
          {d.outlook.map((w, i) => (
            <div key={w.batchDate}>
              <b className="text-ink">{fmtBatch(w.batchDate)}</b>
              <br />
              {i === 0 ? `${w.firm} firm + ${w.pending} pending` : `${w.standing} standing + ${w.oneOff} one-off`}
            </div>
          ))}
        </div>
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer font-semibold">By product & size</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[520px] text-[13px]">
              <thead className="text-left text-black/50">
                <tr>
                  <th className="py-1">Product</th>
                  {d.outlook.map((w, i) => (
                    <th key={w.batchDate} className="py-1 text-right">{fmtBatch(w.batchDate)}{i === 0 ? " (orders)" : ""}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {d.outlookSku.map((s) => (
                  <tr key={s.key}>
                    <td className="py-1"><span className="flex items-center gap-2"><Dot color={s.color} />{s.name} {s.size}</span></td>
                    {s.weeks.map((v, i) => (
                      <td key={i} className="py-1 text-right tabular-nums">{i > 0 ? "~" : ""}{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>
      <p className="mt-4 text-[11px] text-black/40">Storage: {d.storage} · demo seeded {new Date(d.seededAt).toUTCString()} · all figures SAMPLE DATA</p>
    </>
  );
}
