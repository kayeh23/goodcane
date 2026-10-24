import type { NextRequest } from "next/server";
import { body, handle } from "@/lib/api";
import { AppError } from "@/lib/service";
import { initializeTransaction } from "@/lib/payments/paystack";
import { getOrderForPayment } from "@/lib/services/payments";

/**
 * Payment initiation endpoint for Mobile Money and Card pre-orders.
 * Validates order eligibility and calls Paystack to generate a checkout authorization session.
 */
export async function POST(req: NextRequest) {
  const payload = await body(req);
  const orderId = String(payload.orderId ?? "").trim();
  const customerEmail = typeof payload.customerEmail === "string" ? payload.customerEmail.trim() : undefined;
  const callbackUrl = typeof payload.callbackUrl === "string" ? payload.callbackUrl.trim() : undefined;

  if (!orderId) {
    throw new AppError("Missing required parameter: orderId.", 400);
  }

  return handle(async (db) => {
    const context = getOrderForPayment(db, orderId);

    const initResult = await initializeTransaction({
      orderId: context.order.id,
      orderCode: context.order.code,
      amountInCedis: context.payableInCedis,
      customerPhone: context.customerPhone,
      customerEmail,
      callbackUrl,
    });

    return {
      authorization_url: initResult.authorizationUrl,
      access_code: initResult.accessCode,
      reference: initResult.reference,
      order_id: context.order.id,
      order_code: context.order.code,
      amount: context.payableInCedis,
      is_deposit: context.isDeposit,
    };
  });
}
