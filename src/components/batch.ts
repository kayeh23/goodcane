"use client";
import { useSyncExternalStore } from "react";
import { useApi } from "./client";

export type BatchInfo = { now: string; batchDate: string; cutoff: string; pickup: { id: string; available: boolean }[] };

export function useBatch() {
  return useApi<BatchInfo>("/api/batch");
}

function subscribeClock(cb: () => void) {
  const t = setInterval(cb, 15_000);
  return () => clearInterval(t);
}

export function useCountdown(iso?: string) {
  // minute-resolution clock; null during SSR so markup matches on hydration
  const minute = useSyncExternalStore(subscribeClock, () => Math.floor(Date.now() / 60_000), () => null);
  if (!iso || minute === null) return null;
  const ms = Math.max(0, new Date(iso).getTime() - minute * 60_000);
  return { d: Math.floor(ms / 86400000), h: Math.floor((ms / 3600000) % 24), m: Math.floor((ms / 60000) % 60) };
}
