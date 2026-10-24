"use client";
import { useState } from "react";
import { api } from "./client";
import { cedis } from "@/lib/util";

export interface PaymentButtonProps {
  orderId: string;
  orderCode: string;
  amountInCedis: number;
  isDeposit?: boolean;
  disabled?: boolean;
  className?: string;
  onInitiated?: (reference: string) => void;
  onError?: (error: Error) => void;
}

export function MobileMoneyIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
      <circle cx="7" cy="15" r="1" />
      <circle cx="12" cy="15" r="1" />
    </svg>
  );
}

export function PaymentButton({
  orderId,
  orderCode,
  amountInCedis,
  isDeposit = false,
  disabled = false,
  className = "",
  onInitiated,
  onError,
}: PaymentButtonProps) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handlePayment = async () => {
    if (loading || disabled) return;
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await api<{
        authorization_url: string;
        access_code: string;
        reference: string;
        amount: number;
        is_deposit: boolean;
      }>("/api/payments/initialize", {
        body: {
          orderId,
          callbackUrl: `${window.location.origin}/order/${orderId}?payment_ref=`,
        },
      });

      if (onInitiated) {
        onInitiated(response.reference);
      }

      // Redirect customer to Paystack Mobile Money checkout
      if (response.authorization_url) {
        window.location.href = response.authorization_url;
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to initialize payment.");
      setErrorMessage(error.message);
      if (onError) {
        onError(error);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full space-y-2">
      <button
        type="button"
        onClick={handlePayment}
        disabled={disabled || loading}
        aria-busy={loading}
        aria-label={`Pay with Mobile Money for order ${orderCode}`}
        className={`btn w-full justify-center bg-[#073b1c] py-3.5 text-base font-bold text-white shadow-sm hover:bg-[#052d15] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      >
        <MobileMoneyIcon />
        {loading
          ? "Connecting to Paystack..."
          : `Pay with Mobile Money (${cedis(amountInCedis)}${isDeposit ? " deposit" : ""})`}
      </button>

      {errorMessage && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-center text-xs font-medium text-red-700">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
