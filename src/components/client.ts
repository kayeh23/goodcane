"use client";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { LineItem } from "@/lib/types";

export async function api<T = unknown>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(url, {
    method: init?.method ?? (init?.body ? "POST" : "GET"),
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error((data as { error?: string }).error || `Request failed (${res.status})`), { status: res.status });
  return data as T;
}

export function useApi<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<(Error & { status?: number }) | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!url) return;
    let alive = true;
    api<T>(url)
      .then((d) => {
        if (!alive) return;
        setData(d);
        setError(null);
      })
      .catch((e: Error) => alive && setError(e))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [url]);
  const reload = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    try {
      setData(await api<T>(url));
      setError(null);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, [url]);
  return { data, error, loading, reload };
}

export type CartLine = Omit<LineItem, "unitPrice">;
const CART_KEY = "gc_cart_v1";
const PHONE_KEY = "gc_phone_v1";
const NAME_KEY = "gc_name_v1";

function writeLS(key: string, v: unknown) {
  try {
    if (v === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(v));
    window.dispatchEvent(new Event("gc-storage"));
  } catch {}
}

const SSR = "__ssr__";
function subscribeLS(cb: () => void) {
  window.addEventListener("gc-storage", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("gc-storage", cb);
    window.removeEventListener("storage", cb);
  };
}

/** localStorage-backed value via useSyncExternalStore (SSR-safe). */
function useLS<T>(key: string, fallback: T) {
  const raw = useSyncExternalStore(
    subscribeLS,
    () => {
      try {
        return window.localStorage.getItem(key) ?? "";
      } catch {
        return "";
      }
    },
    () => SSR,
  );
  const value = useMemo<T>(() => {
    if (!raw || raw === SSR) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw]);
  const set = useCallback((v: T | null) => writeLS(key, v), [key]);
  return [value, set, raw !== SSR] as const;
}

export function useCart() {
  const [lines, setLines, ready] = useLS<CartLine[]>(CART_KEY, []);
  const setQty = (productId: string, sizeId: string, qty: number) => {
    const rest = lines.filter((l) => !(l.productId === productId && l.sizeId === sizeId));
    const next = qty > 0 ? [...rest, { productId, sizeId, qty: Math.min(20, qty) }] : rest;
    setLines(next);
  };
  const qtyOf = (productId: string, sizeId: string) => lines.find((l) => l.productId === productId && l.sizeId === sizeId)?.qty ?? 0;
  return { lines, ready, setQty, qtyOf, clear: () => setLines([]), replace: (l: CartLine[]) => setLines(l) };
}

/** "My phone" convenience: stored only on this device, never needed to browse. */
export function useSavedPhone() {
  const [phone, setPhone, ready] = useLS<string>(PHONE_KEY, "");
  const [name, setName] = useLS<string>(NAME_KEY, "");
  return { phone, name, ready, save: (p: string, n?: string) => { setPhone(p); if (n) setName(n); }, forget: () => { setPhone(null); setName(null); } };
}
