import { NextResponse, type NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { verifyWebhookSignature } from "@/lib/payments/paystack";
import { recordPaymentSuccess } from "@/lib/services/payments";

/**
 * Paystack Webhook Listener.
 * Receives charge notifications from Paystack, verifies the HMAC-SHA512 signature,
 * and updates order statuses to 'paid' upon 'charge.success'.
 */
export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-paystack-signature");
  let rawBody: string;

  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ error: "Unable to read webhook body." }, { status: 400 });
  }

  // Validate HMAC signature (bypassed in development simulation if no secret configured)
  const isSignatureValid = verifyWebhookSignature(rawBody, signature);
  if (!isSignatureValid && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let eventPayload: {
    event?: string;
    data?: {
      reference?: string;
      status?: string;
      amount?: number;
      channel?: string;
      metadata?: {
        orderId?: string;
        orderCode?: string;
        customerPhone?: string;
      };
    };
  };

  try {
    eventPayload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const { event, data } = eventPayload;

  // Process successful payment charges
  if (event === "charge.success" && data) {
    const orderId = data.metadata?.orderId;
    const reference = data.reference ?? "unknown_ref";
    const amountInCedis = (data.amount ?? 0) / 100;
    const channel = data.channel ?? "mobile_money";

    if (!orderId) {
      console.warn("Paystack webhook received charge.success without metadata.orderId. Reference:", reference);
      return NextResponse.json({ received: true, warning: "Missing metadata.orderId" }, { status: 200 });
    }

    return handle((db) => {
      const result = recordPaymentSuccess(db, {
        orderId,
        reference,
        channel,
        amountPaidInCedis: amountInCedis,
      });

      return {
        received: true,
        orderId: result.order.id,
        status: result.order.status,
        alreadyPaid: result.alreadyPaid,
      };
    });
  }

  // Acknowledge other unhandled Paystack webhook events
  return NextResponse.json({ received: true, ignored: true }, { status: 200 });
}
