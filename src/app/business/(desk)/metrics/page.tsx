"use client";
import type { metrics } from "@/lib/analytics";
import { fmtBatch } from "@/lib/dates";
import { DeskQueryStatus, Kpi, PageTitle, pct, useAdmin } from "@/components/admin";

type M = ReturnType<typeof metrics>;

export default function MetricsPage() {
  const { data: m, error, loading } = useAdmin<M>("/api/admin/metrics");
  if (!m) {
    return (
      <DeskQueryStatus
        loading={loading}
        error={error}
        hasData={false}
        emptyMessage="No metrics yet for this store."
      />
    );
  }
  const maxC = Math.max(1, ...m.weeks.map((w) => w.confirmedOrders));
  const maxU = Math.max(1, ...m.weeks.map((w) => Math.max(w.actualUnits, w.forecastUnits ?? 0)));
  return (
    <>
      <PageTitle title="Metrics" sub="Pilot scorecard · all figures are SAMPLE DATA, for showing how measurement works" right={<span className="pill-sample">Sample data</span>} />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi tone="green" label="Repeat-order rate (last 4 batches)" value={pct(m.repeat.last4.rate)} sub={`${m.repeat.last4.repeaters} of ${m.repeat.last4.customers} ordering customers ordered in 2+ batches · all-time ${pct(m.repeat.all.rate)}`} />
        <Kpi tone="sky" label="Confirmed weekly orders (4-batch avg)" value={m.confirmedWeeklyAvg4.toFixed(1)} sub="Orders confirmed or paid per completed batch" />
        <Kpi tone="red" label="Cancellation rate (last 4 batches)" value={pct(m.cancelRate4, 1)} sub="Cancelled ÷ all orders created, by customer or business" />
        <Kpi tone="tan" label="Forecast accuracy" value={m.mape === null ? "—" : pct(1 - m.mape)} sub={`MAPE ${pct(m.mape, 1)} over ${m.forecastWeeks} batches (forecast snapshot vs firm bottles)`} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi label="Reminder → order conversion" value={pct(m.reminders.rate)} sub={`${m.reminders.converted} of ${m.reminders.sent} reminders opened in WhatsApp led to an order that batch`} />
        <Kpi label="Reminder opt-in" value={pct(m.optIn.optedIn / Math.max(1, m.optIn.customers))} sub={`${m.optIn.optedIn} of ${m.optIn.customers} customers`} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="font-bold">Confirmed orders per batch</h2>
          <div className="mt-4 flex h-40 items-end gap-2">
            {m.weeks.map((w) => (
              <div key={w.batchDate} className="flex flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[11px] font-bold">{w.confirmedOrders}</span>
                <div className={`w-full rounded-t ${w.complete ? "bg-cane" : "bg-cane/40"}`} style={{ height: `${(w.confirmedOrders / maxC) * 120}px` }} />
                <span className="text-[10px] text-black/50">{fmtBatch(w.batchDate).slice(4)}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-black/45">Lighter bar = next batch, still open.</p>
        </section>
        <section className="card p-4">
          <h2 className="font-bold">Forecast vs actual (bottles)</h2>
          <div className="mt-4 flex h-40 items-end gap-2">
            {m.weeks.filter((w) => w.complete).map((w) => (
              <div key={w.batchDate} className="flex flex-1 flex-col items-center justify-end gap-1">
                <div className="flex w-full items-end justify-center gap-0.5">
                  <div className="w-1/2 rounded-t border border-dashed border-black/40 bg-black/5" style={{ height: `${((w.forecastUnits ?? 0) / maxU) * 120}px` }} title={`forecast ${w.forecastUnits ?? "—"}`} />
                  <div className="w-1/2 rounded-t bg-tan" style={{ height: `${(w.actualUnits / maxU) * 120}px` }} title={`actual ${w.actualUnits}`} />
                </div>
                <span className="text-[10px] text-black/50">{fmtBatch(w.batchDate).slice(4)}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-black/45">Dashed = forecast snapshot taken when the batch opened · solid = firm (confirmed+paid) bottles. {m.method}.</p>
        </section>
      </div>

      <section className="card mt-5 overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-cream-2/60 text-left text-[12px] text-black/55">
            <tr>
              <th className="px-4 py-2">Batch</th>
              <th className="px-2 py-2 text-right">Orders</th>
              <th className="px-2 py-2 text-right">Confirmed/paid</th>
              <th className="px-2 py-2 text-right">Cancelled</th>
              <th className="px-2 py-2 text-right">Cancel rate</th>
              <th className="px-2 py-2 text-right">Returning customers</th>
              <th className="px-2 py-2 text-right">Standing</th>
              <th className="px-2 py-2 text-right">Forecast</th>
              <th className="px-2 py-2 text-right">Actual</th>
              <th className="px-4 py-2 text-right">Abs. % error</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {m.weeks.map((w) => (
              <tr key={w.batchDate} className={w.complete ? "" : "bg-lime/10"}>
                <td className="px-4 py-2">{fmtBatch(w.batchDate)}{!w.complete && <span className="ml-1 text-[11px] text-black/50">(open)</span>}</td>
                <td className="px-2 py-2 text-right">{w.orders}</td>
                <td className="px-2 py-2 text-right">{w.confirmedOrders}</td>
                <td className="px-2 py-2 text-right">{w.cancelled}{w.cancelled ? <span className="text-[11px] text-black/45"> ({w.cancelledByCustomer}c/{w.cancelledByBusiness}b)</span> : ""}</td>
                <td className="px-2 py-2 text-right">{pct(w.cancelRate)}</td>
                <td className="px-2 py-2 text-right">{w.returning}/{w.customers}</td>
                <td className="px-2 py-2 text-right">{w.standingOrders}</td>
                <td className="px-2 py-2 text-right">{w.forecastUnits ?? "—"}</td>
                <td className="px-2 py-2 text-right">{w.complete ? w.actualUnits : `${w.actualUnits} so far`}</td>
                <td className="px-4 py-2 text-right">{w.ape === null ? "—" : pct(w.ape)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card mt-5 p-4 text-[13px] leading-relaxed text-black/70">
        <h2 className="mb-1 font-bold text-ink">Definitions</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li><b>Repeat-order rate</b> = customers with non-cancelled orders in ≥2 different batches ÷ customers with ≥1 non-cancelled order, over the window.</li>
          <li><b>Confirmed weekly orders</b> = orders with status Confirmed or Paid for a batch (requests don&apos;t count).</li>
          <li><b>Cancellation rate</b> = cancelled orders ÷ all orders created for the batch (c = by customer, b = by business).</li>
          <li><b>Forecast accuracy</b> = 1 − MAPE, where MAPE = mean(|actual − forecast| ÷ actual) over completed batches. Forecast is snapshotted when a batch opens, so it can&apos;t peek at actuals.</li>
        </ul>
      </section>
    </>
  );
}
