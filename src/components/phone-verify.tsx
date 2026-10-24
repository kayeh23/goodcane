"use client";

import { useEffect, useRef, useState } from "react";
import { normalizeGhanaPhone } from "@/lib/auth/phone";
import { api } from "@/components/client";
import { CustomerHeader, Dot } from "@/components/brand";

type Step = "phone" | "code" | "verified";

interface PhoneVerifyProps {
  /** ARIA label for the phone field when in phone-entry step. */
  phoneLabel?: string;
  /** Helper text shown under the phone field. */
  phoneHelp?: string;
  /** Show a small "Sign out" link that hits /api/auth/logout then reloads. */
  showSignOut?: boolean;
  /** After successful verify, the component reloads the page data via this URL (GET). */
  refreshUrl?: string;
}

export default function PhoneVerify({
  phoneLabel = "Your phone number",
  phoneHelp =
    "We’ll send a 4-digit code by SMS. Ghana numbers only — 024 123 4567 or +233 24 123 4567.",
  showSignOut = false,
  refreshUrl,
}: PhoneVerifyProps) {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [resendSeconds, setResendSeconds] = useState(60);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step !== "code") return;
    const t = setTimeout(() => setResendSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [step]);

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  const normalizedPhone = (() => {
    if (!phone.trim()) return null;
    try {
      return normalizeGhanaPhone(phone);
    } catch {
      return null;
    }
  })();
  const phoneOk = Boolean(normalizedPhone) && phone.trim().length > 0;

  function clearMessage() {
    setMessage(null);
  }

  async function sendCode() {
    clearMessage();
    if (!phoneOk) return;
    setLoading(true);
    try {
      await api("/api/auth/otp/send", { method: "POST", body: { phone } });
      setStep("code");
      setCode("");
      setResendSeconds(60);
    } catch (err) {
      const e = err as Error & { status?: number; response?: { headers?: Record<string, string | string[]> } };
      if (e.status === 400) {
        setMessage({ kind: "err", text: "That doesn’t look like a Ghana phone number. Try 024 123 4567." });
      } else if (e.status === 429) {
        const seconds = retryAfterSeconds(e);
        setMessage({
          kind: "err",
          text: `Too many requests. Please wait ${seconds} seconds before trying again.`,
        });
      } else {
        setMessage({ kind: "err", text: (e as Error).message || "Couldn’t send the code. Check your connection and try again." });
      }
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode() {
    clearMessage();
    if (code.length !== 4) return;
    setLoading(true);
    try {
      await api("/api/auth/otp/verify", {
        method: "POST",
        body: { phone, code },
      });
      setStep("verified");
      if (refreshUrl) {
        try {
          await api(refreshUrl);
        } catch {
          /* refresh is best-effort; the user is already signed in */
        }
      }
    } catch (err) {
      const e = err as Error & { status?: number; response?: { headers?: Record<string, string | string[]> } };
      if (e.status === 400) {
        setMessage({ kind: "err", text: "Enter your 4-digit code to continue." });
      } else if (e.status === 401) {
        setMessage({ kind: "err", text: "That code is incorrect or has expired. Please try again." });
      } else if (e.status === 429) {
        const seconds = retryAfterSeconds(e);
        setMessage({
          kind: "err",
          text: `Too many attempts. Please wait ${seconds} seconds before trying again.`,
        });
      } else {
        setMessage({ kind: "err", text: "Couldn’t verify the code. Check your connection and try again." });
      }
    } finally {
      setLoading(false);
    }
  }

  async function resendCode() {
    clearMessage();
    if (resendSeconds > 0) return;
    setLoading(true);
    try {
      await api("/api/auth/otp/send", { method: "POST", body: { phone } });
      setCode("");
      setResendSeconds(60);
      setMessage({ kind: "ok", text: "A new code has been sent." });
    } catch (err) {
      const e = err as Error & { status?: number; response?: { headers?: Record<string, string | string[]> } };
      if (e.status === 429) {
        const seconds = retryAfterSeconds(e);
        setMessage({ kind: "err", text: `Too many requests. Please wait ${seconds} seconds before trying again.` });
      } else {
        setMessage({ kind: "err", text: "Couldn’t send a new code. Try again in a moment." });
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    setLoading(true);
    try {
      await api("/api/auth/logout", { method: "POST" });
      window.location.reload();
    } catch {
      setMessage({ kind: "err", text: "Couldn’t sign out. Try again." });
    } finally {
      setLoading(false);
    }
  }

  function handlePhoneKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      sendCode();
    }
  }

  function handleCodeKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      verifyCode();
    }
  }

  return (
    <div className="mx-auto max-w-md pb-12">
      <CustomerHeader />
      <main className="space-y-4 px-4">
        <h1 className="font-display text-[28px] font-bold leading-tight">Sign in to your account</h1>
        <p className="text-sm text-black/60">
          We use your phone number to find your orders and confirm checkout.
        </p>

        {message && (
          <p
            role="status"
            className={`rounded-xl border p-3 text-sm ${
              message.kind === "ok"
                ? "border-green-200 bg-green-50 text-green-900"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {message.text}
          </p>
        )}

        {step === "phone" && (
          <form
            className="card space-y-3 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              sendCode();
            }}
          >
            <label className="label" htmlFor="phone-verify-phone">
              {phoneLabel}
            </label>
            <input
              id="phone-verify-phone"
              className="input"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={handlePhoneKeyDown}
              placeholder="024 123 4567"
            />
            <p className="text-[12px] text-black/50">{phoneHelp}</p>
            <button
              type="submit"
              className="btn-dark w-full py-3"
              disabled={loading || !phoneOk}
            >
              {loading ? "Sending…" : "Send code"}
            </button>
          </form>
        )}

        {step === "code" && (
          <form
            className="card space-y-3 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              verifyCode();
            }}
          >
            <label className="label" htmlFor="phone-verify-code">
              Enter the 4-digit code
            </label>
            <input
              id="phone-verify-code"
              ref={codeRef}
              className="input"
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
              onKeyDown={handleCodeKeyDown}
              placeholder="0000"
            />
            <p className="text-[12px] text-black/50">
              Didn’t get a code?{" "}
              <button
                type="button"
                className="text-cane underline font-semibold"
                disabled={loading || resendSeconds > 0}
                onClick={resendCode}
              >
                {resendSeconds > 0 ? `Resend in ${resendSeconds}s` : "Resend code"}
              </button>
            </p>
            <div className="flex gap-2">
              <button
                type="submit"
                className="btn-dark flex-1 py-3"
                disabled={loading || code.length !== 4}
              >
                {loading ? "Verifying…" : "Verify"}
              </button>
              <button
                type="button"
                className="btn-ghost px-4 py-3"
                disabled={loading}
                onClick={() => {
                  setStep("phone");
                  setCode("");
                  clearMessage();
                }}
              >
                Change number
              </button>
            </div>
          </form>
        )}

        {step === "verified" && (
          <div className="card p-4 text-center">
            <Dot color="#16a34a" className="mx-auto mb-3 size-4" />
            <p className="text-sm font-semibold">You’re signed in</p>
            <p className="mt-1 text-[13px] text-black/60">
              We’ve confirmed {normalizedPhone ? normalizedPhone.slice(0, 3) + " *** *" + normalizedPhone.slice(-3) : ""}.
            </p>
            {showSignOut && (
              <div className="mt-4">
                <button
                  className="text-[13px] font-semibold text-black/50 underline"
                  disabled={loading}
                  onClick={handleSignOut}
                >
                  {loading ? "Signing out…" : "Sign out"}
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

/** Best-effort Retry-After from the API error. Falls back to 60. */
function retryAfterSeconds(err: Error & { status?: number; response?: { headers?: Record<string, string | string[]> } }): number {
  if (err.status !== 429) return 60;
  try {
    const data = err.response;
    if (data?.headers?.["retry-after"]) {
      const raw = data.headers["retry-after"];
      const parsed = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "";
      const secs = parseInt(parsed.trim(), 10);
      if (Number.isFinite(secs) && secs > 0) return secs;
    }
  } catch {
    /* ignore */
  }
  return 60;
}
