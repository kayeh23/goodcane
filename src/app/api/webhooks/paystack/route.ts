import { NextResponse, type NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { getPaystackConfig, verifyTransaction, verifyWebhookSignature } from "@/lib/payments/paystack";
import { recordPaymentSuccess } from "@/lib/services/payments";

type PaystackEvent = {
  event?: string;
  data?: {
    reference?: string;
    status?: string;
    amount?: number;
    currency?: string;
    channel?: string;
    metadata?: unknown;
  };
};

function readOrderId(metadata: unknown): string | undefined {
  if (!metadata) return undefined;
  if (typeof metadata === "string") {
    try {
      return readOrderId(JSON.parse(metadata));
    } catch {
      return undefined;
    }
  }
  if (typeof metadata === "object" && metadata && "orderId" in metadata) {
    const id = (metadata as { orderId?: unknown }).orderId;
    return typeof id === "string" && id.trim() ? id : undefined;
  }
  return undefined;
}

/**
 * Paystack charge.success listener.
 * A configured secret requires a valid HMAC. With no secret, only development
 * references that start with sim_ are applied, and the amount still has to
 * cover the order.
 */
export async function POST(req: NextRequest) {
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ error: "Unable to read webhook body." }, { status: 400 });
  }

  let eventPayload: PaystackEvent;
  try {
    eventPayload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const { event, data } = eventPayload;
  if (event !== "charge.success" || !data) {
    return NextResponse.json({ received: true, ignored: true }, { status: 200 });
  }

  const signature = req.headers.get("x-paystack-signature");
  const signatureOk = verifyWebhookSignature(rawBody, signature);
  const { isConfigured } = getPaystackConfig();
  const reference = data.reference ?? "";
  const devSim = !isConfigured && process.env.NODE_ENV !== "production" && reference.startsWith("sim_");

  if (!signatureOk && !devSim) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let orderId = readOrderId(data.metadata);
  let amountPesewas = Math.round(data.amount ?? 0);
  let channel = data.channel;
  let settledReference = reference || "unknown_ref";

  if (signatureOk) {
    if (!reference) {
      return NextResponse.json({ received: true, applied: false, reason: "Missing reference." }, { status: 200 });
    }
    try {
      const verified = await verifyTransaction(reference);
      if (!verified.success || verified.currency !== "GHS") {
        return NextResponse.json({ received: true, applied: false, reason: "Paystack has not confirmed this charge." }, { status: 200 });
      }
      orderId = verified.metadata?.orderId || orderId;
      amountPesewas = Math.round(verified.amountInCedis * 100);
      channel = verified.channel ?? channel;
      settledReference = verified.reference || settledReference;
    } catch (e) {
      console.error("[webhooks/paystack] verify", e);
      return NextResponse.json({ error: "Could not verify the charge with Paystack." }, { status: 502 });
    }
  }

  if (!orderId) {
    return NextResponse.json({ received: true, applied: false, reason: "Missing order id." }, { status: 200 });
  }

  return handle((db) => {
    const result = recordPaymentSuccess(db, {
      orderId,
      reference: settledReference,
      channel,
      amountPaidPesewas: amountPesewas,
    });
    if (!result.ok) {
      return NextResponse.json({ received: true, applied: false, reason: result.reason }, { status: 200 });
    }
    return {
      received: true,
      applied: true,
      orderId: result.order.id,
      status: result.order.status,
      alreadyPaid: result.alreadyPaid,
    };
  });
}
