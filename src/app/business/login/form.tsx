"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DemoBanner, Wordmark } from "@/components/brand";
import { api } from "@/components/client";

export default function LoginForm({ demoPasscode }: { demoPasscode: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="min-h-dvh">
      <DemoBanner dark />
      <div className="mx-auto max-w-sm px-5 pt-12">
        <Wordmark size="lg" />
        <h1 className="mt-6 font-display text-3xl font-bold">Batch desk</h1>
        <p className="mt-1 text-sm text-black/60">GoodCane&apos;s view of pre-orders and upcoming demand.</p>
        <form
          className="card mt-6 space-y-3 p-5"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setErr(null);
            try {
              await api("/api/admin/login", { body: { passcode: code } });
              router.push("/business");
            } catch (e) {
              setErr((e as Error).message);
              setBusy(false);
            }
          }}
        >
          <label className="label" htmlFor="passcode">
            Passcode
          </label>
          <input id="passcode" className="input" type="password" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} />
          {err && <p className="text-sm text-red-700">{err}</p>}
          <button className="btn-dark w-full py-3" disabled={busy}>
            {busy ? "Checking…" : "Open batch desk"}
          </button>
          <div className="rounded-xl border border-dashed border-amber/50 bg-amber/5 p-3 text-[13px] text-amber">
            <b>Demo only:</b> passcode is <code className="rounded bg-white px-1.5 py-0.5 font-mono font-bold">{demoPasscode}</code>
            <br />A real pilot would use proper staff accounts.
          </div>
        </form>
        <p className="mt-4 text-center text-sm">
          <Link href="/" className="font-semibold text-cane">
            ← Customer view
          </Link>
        </p>
      </div>
    </div>
  );
}
