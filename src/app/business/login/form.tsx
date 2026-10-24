"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { DemoBanner, Wordmark } from "@/components/brand";
import { api } from "@/components/client";

/** Only follow same-origin relative paths — never "//host" or absolute URLs. */
function safeNext(next: string | null): string {
  if (next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")) {
    return next;
  }
  return "/business";
}

export default function LoginForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="min-h-dvh">
      <DemoBanner dark />
      <div className="mx-auto max-w-sm px-5 pt-12 pb-12">
        <Wordmark size="lg" />
        <h1 className="mt-6 font-display text-3xl font-bold">Batch desk</h1>
        <p className="mt-1 text-sm text-black/60">Staff sign-in for GoodCane&apos;s pre-orders and demand view.</p>
        <form
          className="card mt-6 space-y-3 p-5"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setErr(null);
            try {
              await api("/api/auth/login", { body: { username: username.trim(), password } });
              router.push(next);
            } catch (e) {
              setErr((e as Error).message);
              setBusy(false);
            }
          }}
        >
          <label className="label" htmlFor="username">
            Username
          </label>
          <input
            id="username"
            className="input"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {err && (
            <p role="alert" className="text-sm text-red-700">
              {err}
            </p>
          )}
          <button className="btn-dark w-full py-3" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
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
