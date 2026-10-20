import Link from "next/link";

export function Wordmark({ size = "md", invert = false }: { size?: "sm" | "md" | "lg"; invert?: boolean }) {
  const s = size === "lg" ? "text-3xl px-3 py-2" : size === "sm" ? "text-[13px] px-1.5 py-1" : "text-lg px-2.5 py-1.5";
  return (
    <span
      aria-label="GoodCane"
      className={`inline-flex flex-col rounded-lg font-display font-bold leading-[0.85] tracking-tight uppercase ${s} ${invert ? "bg-white text-ink" : "bg-ink text-white"}`}
    >
      <span>Good</span>
      <span>Cane</span>
    </span>
  );
}

export function DemoBanner({ dark = false }: { dark?: boolean }) {
  return (
    <div className={`px-4 py-1.5 text-center text-[11px] font-semibold tracking-wide ${dark ? "bg-amber text-white" : "bg-amber/10 text-amber"}`}>
      DEMO — sample data · prototype for GoodCane · no live payments or messages
    </div>
  );
}

export function CustomerHeader({ right }: { right?: React.ReactNode }) {
  return (
    <header className="flex items-center justify-between px-5 pt-4 pb-3">
      <Link href="/" aria-label="GoodCane home">
        <Wordmark />
      </Link>
      <div className="flex items-center gap-3">
        <span className="pill-sample">Sample data</span>
        {right ?? (
          <Link href="/my-orders" className="text-sm font-semibold text-cane">
            My orders
          </Link>
        )}
      </div>
    </header>
  );
}

export function Dot({ color, className = "" }: { color: string; className?: string }) {
  return <span aria-hidden className={`inline-block size-2.5 shrink-0 rounded-full ${className}`} style={{ background: color }} />;
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    requested: "bg-amber-100 text-amber-900 border-amber-300",
    confirmed: "bg-sky-50 text-sky-900 border-sky-300",
    paid: "bg-green-50 text-green-900 border-green-300",
    cancelled: "bg-red-50 text-red-800 border-red-200",
    pending: "bg-amber-100 text-amber-900 border-amber-300",
    approved: "bg-sky-50 text-sky-900 border-sky-300",
    opened_whatsapp: "bg-green-50 text-green-900 border-green-300",
    dismissed: "bg-zinc-100 text-zinc-600 border-zinc-300",
    active: "bg-green-50 text-green-900 border-green-300",
    paused: "bg-zinc-100 text-zinc-700 border-zinc-300",
  };
  const label: Record<string, string> = { requested: "Request", approved: "Approved", opened_whatsapp: "Opened in WhatsApp" };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold tracking-wide uppercase ${map[status] ?? "bg-zinc-100"}`}>
      {label[status] ?? status}
    </span>
  );
}
