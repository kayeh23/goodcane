"use client";
import { useState } from "react";
import { api } from "./client";
import { cedis } from "@/lib/util";

export function PaymentButton({
  orderId,
  orderCode,
  amountInCedis,
  isDeposit = false,
  disabled = false,
  className = "",
}: {
  orderId: string;
  orderCode: string;
  amountInCedis: number;
  isDeposit?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handlePayment = async () => {
    if (loading || disabled) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await api<{ authorization_url: string }>("/api/payments/initialize", {
        body: { orderId },
      });
      if (response.authorization_url) window.location.href = response.authorization_url;
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to initialize payment.");
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
        className={`btn-dark w-full py-3 ${className}`}
      >
        {loading
          ? "Connecting to Paystack..."
          : `Pay with Mobile Money (${cedis(amountInCedis)}${isDeposit ? " deposit" : ""})`}
      </button>
      {errorMessage && (
        <p role="alert" className="text-center text-sm text-red-700">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
