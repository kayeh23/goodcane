import crypto from "crypto";

export interface InitializePaymentInput {
  orderId: string;
  orderCode: string;
  amountInCedis: number;
  customerPhone: string;
  customerEmail?: string;
  callbackUrl: string;
}

export interface InitializePaymentResult {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

export interface PaystackVerifyResult {
  success: boolean;
  status: string;
  reference: string;
  amountInCedis: number;
  currency: string;
  channel?: string;
  paidAt?: string;
  metadata?: {
    orderId?: string;
    orderCode?: string;
    customerPhone?: string;
  };
}

const PAYSTACK_API_BASE = "https://api.paystack.co";

export function getPaystackConfig() {
  const secretKey = process.env.PAYSTACK_SECRET_KEY || "";
  const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || "";
  const webhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET || secretKey;

  return {
    secretKey,
    publicKey,
    webhookSecret,
    isConfigured: Boolean(secretKey),
  };
}

function fallbackEmail(phone: string, orderCode: string): string {
  const digits = phone.replace(/\D/g, "");
  const identifier = digits.length > 0 ? digits : orderCode.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${identifier}@order.goodcane.co`;
}

/**
 * Initializes a Paystack transaction for Ghana Mobile Money and card.
 * Without a secret key, development returns a local simulated checkout URL.
 */
export async function initializeTransaction(input: InitializePaymentInput): Promise<InitializePaymentResult> {
  const { secretKey, isConfigured } = getPaystackConfig();

  if (!isConfigured) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Payment gateway configuration missing: PAYSTACK_SECRET_KEY is not defined.");
    }
    const simRef = `sim_${input.orderCode.toLowerCase().replace(/[^a-z0-9]/g, "")}_${Date.now()}`;
    return {
      authorizationUrl: `/order/${input.orderId}?simulated_payment=success&reference=${simRef}`,
      accessCode: `sim_access_${Date.now()}`,
      reference: simRef,
    };
  }

  const amountInPesewas = Math.round(input.amountInCedis * 100);
  if (amountInPesewas <= 0) throw new Error("Invalid payment amount: must be greater than 0 GHS.");

  const reference = `gc_${input.orderCode.toLowerCase().replace(/[^a-z0-9]/g, "")}_${Date.now()}`;
  const email = input.customerEmail?.trim() || fallbackEmail(input.customerPhone, input.orderCode);

  const payload = {
    email,
    amount: amountInPesewas,
    currency: "GHS",
    channels: ["mobile_money", "card"],
    reference,
    callback_url: input.callbackUrl,
    metadata: {
      orderId: input.orderId,
      orderCode: input.orderCode,
      customerPhone: input.customerPhone,
    },
  };

  const response = await fetch(`${PAYSTACK_API_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json();
  if (!response.ok || !body.status) {
    const errorMsg = body?.message || "Failed to initialize payment transaction with Paystack.";
    throw new Error(`Paystack error: ${errorMsg}`);
  }

  return {
    authorizationUrl: body.data.authorization_url,
    accessCode: body.data.access_code,
    reference: body.data.reference,
  };
}

export async function verifyTransaction(reference: string): Promise<PaystackVerifyResult> {
  const { secretKey, isConfigured } = getPaystackConfig();

  if (!isConfigured) {
    if (reference.startsWith("sim_")) {
      return {
        success: true,
        status: "success",
        reference,
        amountInCedis: 0,
        currency: "GHS",
        paidAt: new Date().toISOString(),
      };
    }
    throw new Error("Payment gateway configuration missing: PAYSTACK_SECRET_KEY is not defined.");
  }

  const response = await fetch(`${PAYSTACK_API_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
  });

  const body = await response.json();
  if (!response.ok || !body.status) {
    const errorMsg = body?.message || "Failed to verify payment transaction with Paystack.";
    throw new Error(`Paystack error: ${errorMsg}`);
  }

  const data = body.data;
  return {
    success: data.status === "success",
    status: data.status,
    reference: data.reference,
    amountInCedis: (data.amount || 0) / 100,
    currency: data.currency || "GHS",
    channel: data.channel,
    paidAt: data.paid_at,
    metadata: data.metadata,
  };
}

/** HMAC-SHA512 of the raw body, compared in constant time to x-paystack-signature. */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;

  const { webhookSecret } = getPaystackConfig();
  if (!webhookSecret) return false;

  const computedHash = crypto.createHmac("sha512", webhookSecret).update(rawBody).digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(computedHash, "utf8"), Buffer.from(signature, "utf8"));
  } catch {
    return false;
  }
}
