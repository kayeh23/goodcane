"use client";

import { useState } from "react";
import type { DecoratedOrder, PackingStage } from "@/lib/analytics";
import { getProduct, getSize } from "@/lib/config";
import { StatusBadge } from "@/components/brand";
import { PackingStageToggle } from "./packing-stage-toggle";

export type PackingTableData = {
  id: string;
  title: string;
  subtitle: string;
  type: "pickup" | "delivery";
  pointId?: string;
  orders: DecoratedOrder[];
  stats: {
    ordersCount: number;
    bottlesCount: number;
    bottledCount: number;
    packedCount: number;
    collectedCount: number;
  };
  skuSummary: Array<{
    productId: string;
    sizeId: string;
    productName: string;
    sizeLabel: string;
    color: string;
    qty: number;
  }>;
};

interface PackingTableProps {
  table: PackingTableData;
  onUpdateStage: (orderId: string, stage: PackingStage) => Promise<void>;
  busyId?: string | null;
}

export function PackingTable({ table, onUpdateStage, busyId }: PackingTableProps) {
  const [filter, setFilter] = useState<"all" | PackingStage>("all");
  const [showRecipes, setShowRecipes] = useState(true);

  const filteredOrders = table.orders.filter((o) => {
    if (filter === "all") return true;
    return o.packingStage === filter;
  });

  const completionPct =
    table.stats.bottlesCount > 0
      ? Math.round((table.stats.collectedCount / table.stats.bottlesCount) * 100)
      : 0;

  return (
    <section className="card overflow-hidden" aria-labelledby={`table-title-${table.id}`}>
      {/* Header */}
      <div className="border-b border-black/10 bg-cream-2/70 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 id={`table-title-${table.id}`} className="font-display text-xl font-bold">
                {table.title}
              </h2>
              <span className="rounded-full bg-black/10 px-2 py-0.5 text-xs font-semibold text-black/70">
                {table.stats.bottlesCount} {table.stats.bottlesCount === 1 ? "bottle" : "bottles"}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-black/60">{table.subtitle}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowRecipes(!showRecipes)}
              className="rounded-lg border border-black/15 bg-white px-2.5 py-1 text-xs font-medium text-black/70 hover:bg-black/5"
            >
              {showRecipes ? "Hide prep summary" : "Show prep summary"}
            </button>
            <div className="flex rounded-lg bg-black/5 p-0.5 text-xs font-semibold">
              {(["all", "pending", "bottled", "packed", "collected"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setFilter(st)}
                  className={`rounded-md px-2 py-1 capitalize transition ${
                    filter === st ? "bg-white text-ink shadow-sm" : "text-black/50 hover:text-black"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-black/60">
            <span>
              Bottled: <b>{table.stats.bottledCount}</b> · Packed: <b>{table.stats.packedCount}</b> · Collected: <b>{table.stats.collectedCount}</b>
            </span>
            <span>{completionPct}% fulfilled</span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-black/10">
            <div
              className="h-full bg-cane transition-all duration-300"
              style={{ width: `${completionPct}%` }}
              role="progressbar"
              aria-valuenow={completionPct}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>

        {/* SKU Summary Breakdown */}
        {showRecipes && table.skuSummary.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 pt-2 border-t border-black/5">
            <span className="text-xs font-bold text-black/50 self-center mr-1">Batch prep:</span>
            {table.skuSummary.map((sku) => (
              <span
                key={`${sku.productId}:${sku.sizeId}`}
                className="flex items-center gap-1.5 rounded-md border border-black/10 bg-white px-2 py-0.5 text-xs font-medium"
              >
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: sku.color }}
                />
                <span className="text-black/70">{sku.productName} ({sku.sizeLabel}):</span>
                <b>{sku.qty}</b>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Orders List */}
      <div className="divide-y divide-black/10">
        {filteredOrders.length === 0 ? (
          <div className="p-8 text-center text-sm text-black/50">
            {filter === "all"
              ? "No confirmed or paid orders for this table in this batch."
              : "No orders match the current filter in this table."}
          </div>
        ) : (
          filteredOrders.map((order) => (
            <div
              key={order.id}
              className="grid gap-3 p-4 transition hover:bg-cream-2/30 sm:grid-cols-[1.1fr_1.5fr_auto] sm:items-center"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-bold text-ink">{order.code}</span>
                  <StatusBadge status={order.status} />
                  {order.standingOrderId && (
                    <span className="rounded-full bg-tan/20 px-2 py-0.5 text-[10px] font-semibold text-[#7a5631]">
                      Standing
                    </span>
                  )}
                </div>
                <div className="mt-1 text-sm font-medium text-black/90">
                  {order.customerName}
                </div>
                <div className="text-xs text-black/55">{order.customerPhone}</div>
                {order.fulfilment.type === "delivery" && order.fulfilment.landmark && (
                  <div className="mt-0.5 text-xs text-black/50">
                    Landmark: {order.fulfilment.landmark}
                  </div>
                )}
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-black/45">
                  Items ({order.units} {order.units === 1 ? "bottle" : "bottles"})
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {order.items.map((item, idx) => {
                    const prod = getProduct(item.productId);
                    const size = getSize(item.productId, item.sizeId);
                    return (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 rounded bg-black/5 px-2 py-1 text-xs text-black/80"
                      >
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: prod?.color ?? "#b9d84a" }}
                        />
                        <span className="font-bold">{item.qty}x</span>
                        <span>{prod?.short ?? item.productId}</span>
                        <span className="text-black/50">{size?.label ?? item.sizeId}</span>
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col items-start sm:items-end gap-1.5">
                <PackingStageToggle
                  orderId={order.id}
                  orderCode={order.code}
                  stage={order.packingStage}
                  disabled={busyId === order.id}
                  onStageChange={(nextStage) => onUpdateStage(order.id, nextStage)}
                />
                <span className="text-[11px] font-medium text-black/45">
                  Current stage: <b className="capitalize text-ink">{order.packingStage}</b>
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
