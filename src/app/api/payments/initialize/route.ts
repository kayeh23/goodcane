import { NextResponse, type NextRequest } from "next/server";
import { body, handle } from "@/lib/api";
import { initializeTransaction } from "@/lib/payments/paystack";
import { getOrderForPayment } from "@/lib/services/payments";

/**
 * Starts Mobile Money or card checkout for a confirmed order.
 * The Paystack return URL is built here. The request body cannot set it.
 *
 * POST { orderId, customerEmail? }
 * 200 { authorization_url, access_code, reference, order_id, order_code, amount, total, is_deposit }
 */
export async function POST(req: NextRequest) {
  const payload = await body(req);
  const orderId = String(payload.orderId ?? "").trim();
  const customerEmail = typeof payload.customerEmail === "string" ? payload.customerEmail.trim() : undefined;

  if (!orderId) {
    return NextResponse.json({ error: "Missing required parameter: orderId." }, { status: 400 });
  }

  const callbackUrl = `${req.nextUrl.origin}/order/${orderId}`;

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
      total: context.totalInCedis,
      is_deposit: context.isDeposit,
    };
  });
}
