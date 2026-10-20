"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useApi } from "./client";

/** Admin data hook: redirects to the passcode screen on 401. */
export function useAdmin<T>(url: string) {
  const router = useRouter();
  const r = useApi<T>(url);
  useEffect(() => {
    if (r.error?.status === 401) router.replace("/business/login");
  }, [r.error, router]);
  return r;
}

export function Kpi({ label, value, sub, tone = "ink" }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "ink" | "amber" | "sky" | "green" | "red" | "tan" }) {
  const c = { ink: "text-ink", amber: "text-amber", sky: "text-sky-800", green: "text-cane", red: "text-red-700", tan: "text-[#7a5631]" }[tone];
  return (
    <div className="card p-4">
      <p className={`text-[12px] font-semibold ${c}`}>{label}</p>
      <p className="mt-1 font-display text-[26px] font-bold leading-none">{value}</p>
      {sub && <p className="mt-1.5 text-[12px] leading-snug text-black/55">{sub}</p>}
    </div>
  );
}

export function PageTitle({ title, sub, right }: { title: string; sub?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-[28px] font-bold leading-tight">{title}</h1>
        {sub && <p className="text-sm text-black/55">{sub}</p>}
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}

export const pct = (x: number | null | undefined, d = 0) => (x === null || x === undefined ? "—" : `${(x * 100).toFixed(d)}%`);
