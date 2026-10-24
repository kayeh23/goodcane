"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { DemoBanner, Wordmark } from "@/components/brand";
import { api } from "@/components/client";

const NAV = [
  { href: "/business", label: "Overview" },
  { href: "/business/orders", label: "Orders" },
  { href: "/business/packing", label: "Packing" },
  { href: "/business/reminders", label: "Reminders" },
  { href: "/business/metrics", label: "Metrics" },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/business/login");
  };
  return (
    <div className="min-h-dvh lg:flex">
      <aside className="hidden w-56 shrink-0 flex-col bg-ink p-4 text-white lg:flex lg:min-h-dvh">
        <div className="flex items-center gap-3">
          <Wordmark invert size="sm" />
          <div>
            <p className="text-sm font-bold">Batch desk</p>
            <p className="text-[11px] text-white/50">Prototype</p>
          </div>
        </div>
        <nav className="mt-8 space-y-1">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${path === n.href ? "bg-white/10 font-semibold" : "text-white/70 hover:bg-white/5"}`}>
              <span className={`size-1.5 rounded-full ${path === n.href ? "bg-lime" : "bg-white/30"}`} />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto space-y-3">
          <p className="rounded-lg bg-white/5 p-3 text-[11px] leading-relaxed text-white/60">All customers, orders & numbers are SAMPLE DATA. No live payments or automatic messaging.</p>
          <div className="flex justify-between text-[12px]">
            <Link href="/" className="text-white/60 hover:text-white">Customer view ↗</Link>
            <button onClick={logout} className="text-white/60 hover:text-white">Log out</button>
          </div>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <DemoBanner />
        <header className="sticky top-0 z-10 border-b border-black/10 bg-cream/95 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-2">
              <Wordmark size="sm" />
              <span className="text-sm font-bold">Batch desk</span>
            </div>
            <button onClick={logout} className="text-[13px] font-semibold text-black/50">Log out</button>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold ${path === n.href ? "bg-ink text-white" : "bg-white text-black/60"}`}>
                {n.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-6xl p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
