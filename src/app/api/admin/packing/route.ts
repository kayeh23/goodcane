import type { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { decorate, type DecoratedOrder } from "@/lib/analytics";
import { getPickup, getProduct, getSize } from "@/lib/config";
import { nextBatch } from "@/lib/dates";
import { isFirm, unitsOf } from "@/lib/util";

export type PackingTableGroup = {
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

export type PackingApiResponse = {
  batch: string;
  nextBatch: string;
  batches: string[];
  tables: PackingTableGroup[];
  summary: {
    totalOrders: number;
    totalBottles: number;
    bottledBottles: number;
    packedBottles: number;
    collectedBottles: number;
  };
};

function buildSkuSummary(orders: DecoratedOrder[]) {
  const map = new Map<string, { productId: string; sizeId: string; productName: string; sizeLabel: string; color: string; qty: number }>();
  for (const o of orders) {
    for (const item of o.items) {
      const key = `${item.productId}:${item.sizeId}`;
      const prod = getProduct(item.productId);
      const size = getSize(item.productId, item.sizeId);
      const existing = map.get(key);
      if (existing) {
        existing.qty += item.qty;
      } else {
        map.set(key, {
          productId: item.productId,
          sizeId: item.sizeId,
          productName: prod?.name ?? item.productId,
          sizeLabel: size?.label ?? item.sizeId,
          color: prod?.color ?? "#b9d84a",
          qty: item.qty,
        });
      }
    }
  }
  return [...map.values()].sort((a, b) => b.qty - a.qty);
}

function calculateGroupStats(orders: DecoratedOrder[]) {
  let bottlesCount = 0;
  let bottledCount = 0;
  let packedCount = 0;
  let collectedCount = 0;

  for (const o of orders) {
    const units = unitsOf(o.items);
    bottlesCount += units;
    if (o.packingStage === "bottled" || o.packingStage === "packed" || o.packingStage === "collected") {
      bottledCount += units;
    }
    if (o.packingStage === "packed" || o.packingStage === "collected") {
      packedCount += units;
    }
    if (o.packingStage === "collected") {
      collectedCount += units;
    }
  }

  return {
    ordersCount: orders.length,
    bottlesCount,
    bottledCount,
    packedCount,
    collectedCount,
  };
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  return handle(
    (db) => {
      const B = nextBatch();
      const batch = sp.get("batch") || B;
      const batches = [...new Set(db.orders.map((o) => o.batchDate))].sort().reverse();

      const batchOrders = db.orders
        .filter((o) => o.batchDate === batch && isFirm(o))
        .sort((a, b) => a.code.localeCompare(b.code))
        .map((o) => decorate(db, o));

      const adentaPickup = getPickup("adenta");
      const parksPickup = getPickup("parks-gardens");
      const butterflyPickup = getPickup("green-butterfly");

      const adentaOrders = batchOrders.filter(
        (o) => o.fulfilment.type === "pickup" && o.fulfilment.pointId === "adenta",
      );
      const parksOrders = batchOrders.filter(
        (o) => o.fulfilment.type === "pickup" && o.fulfilment.pointId === "parks-gardens",
      );
      const butterflyOrders = batchOrders.filter(
        (o) => o.fulfilment.type === "pickup" && o.fulfilment.pointId === "green-butterfly",
      );
      const deliveryOrders = batchOrders.filter((o) => o.fulfilment.type === "delivery");

      const tables: PackingTableGroup[] = [
        {
          id: "adenta",
          title: "Adenta Shop Table",
          subtitle: adentaPickup?.detail ?? "Aviation Road, Adenta",
          type: "pickup",
          pointId: "adenta",
          orders: adentaOrders,
          stats: calculateGroupStats(adentaOrders),
          skuSummary: buildSkuSummary(adentaOrders),
        },
        {
          id: "parks-gardens",
          title: "Parks & Gardens Table",
          subtitle: parksPickup?.detail ?? "1st & 3rd Saturdays",
          type: "pickup",
          pointId: "parks-gardens",
          orders: parksOrders,
          stats: calculateGroupStats(parksOrders),
          skuSummary: buildSkuSummary(parksOrders),
        },
        {
          id: "green-butterfly",
          title: "Green Butterfly Table",
          subtitle: butterflyPickup?.detail ?? "Cantonments",
          type: "pickup",
          pointId: "green-butterfly",
          orders: butterflyOrders,
          stats: calculateGroupStats(butterflyOrders),
          skuSummary: buildSkuSummary(butterflyOrders),
        },
        {
          id: "delivery-dispatch",
          title: "Delivery Dispatch Table",
          subtitle: "Accra door-to-door delivery coordination",
          type: "delivery",
          orders: deliveryOrders,
          stats: calculateGroupStats(deliveryOrders),
          skuSummary: buildSkuSummary(deliveryOrders),
        },
      ];

      const summary = {
        totalOrders: batchOrders.length,
        totalBottles: tables.reduce((acc, t) => acc + t.stats.bottlesCount, 0),
        bottledBottles: tables.reduce((acc, t) => acc + t.stats.bottledCount, 0),
        packedBottles: tables.reduce((acc, t) => acc + t.stats.packedCount, 0),
        collectedBottles: tables.reduce((acc, t) => acc + t.stats.collectedCount, 0),
      };

      return {
        batch,
        nextBatch: B,
        batches,
        tables,
        summary,
      };
    },
    { admin: req },
  );
}
