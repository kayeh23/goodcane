"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import type { PackingStage } from "@/lib/analytics";
import { fmtBatch } from "@/lib/dates";
import { DeskQueryStatus, Kpi, PageTitle, useAdmin } from "@/components/admin";
import { api } from "@/components/client";
import { PackingTable } from "@/components/packing-table";
import type { PackingApiResponse } from "@/app/api/admin/packing/route";

export default function PackingPage() {
  const sp = useSearchParams();
  const [batch, setBatch] = useState(sp.get("batch") ?? "");
  const [activeLocation, setActiveLocation] = useState<string>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const query = batch ? `?batch=${encodeURIComponent(batch)}` : "";
  const { data, error, loading, reload } = useAdmin<PackingApiResponse>(`/api/admin/packing${query}`);

  const handleUpdateStage = async (orderId: string, nextStage: PackingStage) => {
    setBusyId(orderId);
    try {
      await api(`/api/admin/orders/${orderId}`, {
        body: { action: "pack_stage", reason: nextStage },
      });
      setMsg(`Updated order stage to ${nextStage}.`);
      await reload();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const currentBatch = batch || data?.batch || "";
  const tables = data?.tables ?? [];
  const visibleTables =
    activeLocation === "all" ? tables : tables.filter((t) => t.id === activeLocation);

  const totalBottles = data?.summary.totalBottles ?? 0;
  const bottledBottles = data?.summary.bottledBottles ?? 0;
  const packedBottles = data?.summary.packedBottles ?? 0;
  const collectedBottles = data?.summary.collectedBottles ?? 0;

  const blocked = (
    <DeskQueryStatus
      loading={loading}
      error={error}
      hasData={!!data}
      emptyMessage="The four fulfillment tables will show here once a batch is available."
    />
  );

  return (
    <>
      <PageTitle
        title="Kitchen Pack Sheet"
        sub={
          data
            ? `${totalBottles} bottles across ${data.summary.totalOrders} confirmed & paid orders · ${fmtBatch(data.batch)}`
            : "Confirmed and paid bottles by pickup table and delivery dispatch."
        }
        right={
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Select batch date"
              className="rounded-lg border border-black/15 bg-white px-3 py-1.5 text-sm font-medium"
              value={currentBatch}
              onChange={(e) => setBatch(e.target.value)}
            >
              {data?.batches.map((b) => (
                <option key={b} value={b}>
                  {fmtBatch(b)}
                  {b === data.nextBatch ? " (next)" : ""}
                </option>
              ))}
            </select>
            <Link
              href={`/api/admin/export?batch=${encodeURIComponent(currentBatch || data?.nextBatch || "")}`}
              className="rounded-lg border border-black/15 bg-white px-3 py-1.5 text-sm font-semibold text-black/75 hover:bg-black/5"
            >
              Export CSV
            </Link>
          </div>
        }
      />

      {msg && (
        <div
          role="status"
          className="mb-4 flex items-center justify-between rounded-xl border border-black/10 bg-white p-3 text-sm text-ink shadow-sm"
        >
          <span>{msg}</span>
          <button
            type="button"
            onClick={() => setMsg(null)}
            className="text-xs font-semibold text-black/50 hover:text-black"
          >
            Dismiss
          </button>
        </div>
      )}

      {blocked}

      {data && (
        <>
      {/* Overview KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi
          label="Total bottles"
          value={totalBottles}
          sub={`${data.summary.totalOrders} orders to fulfill`}
          tone="ink"
        />
        <Kpi
          label="Bottled"
          value={bottledBottles}
          sub={totalBottles ? `${Math.round((bottledBottles / totalBottles) * 100)}% pressed & bottled` : "0%"}
          tone="amber"
        />
        <Kpi
          label="Packed"
          value={packedBottles}
          sub={totalBottles ? `${Math.round((packedBottles / totalBottles) * 100)}% boxed for pickup` : "0%"}
          tone="sky"
        />
        <Kpi
          label="Collected / Out"
          value={collectedBottles}
          sub={totalBottles ? `${Math.round((collectedBottles / totalBottles) * 100)}% handed to customer` : "0%"}
          tone="green"
        />
      </div>

      {/* Location Filter Tabs */}
      <div className="mb-5 flex flex-wrap gap-1.5 border-b border-black/10 pb-3">
        <button
          type="button"
          onClick={() => setActiveLocation("all")}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            activeLocation === "all"
              ? "bg-ink text-white"
              : "bg-white text-black/60 hover:bg-black/5"
          }`}
        >
          All Locations ({tables.reduce((acc, t) => acc + t.stats.ordersCount, 0)})
        </button>
        {tables.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveLocation(t.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeLocation === t.id
                ? "bg-ink text-white"
                : "bg-white text-black/60 hover:bg-black/5"
            }`}
          >
            {t.title.replace(" Table", "")} ({t.stats.bottlesCount})
          </button>
        ))}
      </div>

      <div className="space-y-6">
        {visibleTables.map((tbl) => (
          <PackingTable
            key={tbl.id}
            table={tbl}
            busyId={busyId}
            onUpdateStage={handleUpdateStage}
          />
        ))}
      </div>
        </>
      )}
    </>
  );
}
