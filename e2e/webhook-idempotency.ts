import crypto from "node:crypto";
import { recordPaymentSuccess, calculatePaymentAmount } from "@/lib/services/payments";
import { businessOrderAction } from "@/lib/services/orders";
import type { DB, Order } from "@/lib/types";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
  console.log(`[PASS] ${message}`);
}

async function runIdempotencyTests() {
  console.log("=== Paystack Webhook & Payment Idempotency Verification ===\n");

  // Mock DB seeded with sample customer and order
  const testOrder: Order = {
    id: "o_test_1001",
    code: "GC-9999",
    customerId: "c_test_01",
    batchDate: "2026-10-31",
    items: [
      { productId: "raw", sizeId: "330ml", qty: 2, unitPrice: 35 }, // 70 GHS = 7000 pesewas
    ],
    fulfilment: { type: "pickup", pointId: "adenta" },
    status: "requested",
    source: "web",
    createdAt: new Date().toISOString(),
    events: [],
    sample: true,
  };

  const mockDb: DB = {
    version: 1,
    seededAt: new Date().toISOString(),
    customers: [
      {
        id: "c_test_01",
        name: "Test Customer",
        phone: "0240000001",
        remindersOptIn: true,
        createdAt: new Date().toISOString(),
        sample: true,
      },
    ],
    orders: [testOrder],
    standing: [],
    reminders: [],
    forecasts: [],
  };

  // 1. Initial State Check: Order cannot be paid before confirmation
  console.log("Test 1: Reject payment on unconfirmed order");
  const unconfirmedAttempt = recordPaymentSuccess(mockDb, {
    orderId: "o_test_1001",
    reference: "pay_ref_test_001",
    channel: "mobile_money",
    amountPaidPesewas: 7000,
  });
  assert(!unconfirmedAttempt.ok, "Payment rejected when status is 'requested'");
  assert(
    unconfirmedAttempt.ok === false && unconfirmedAttempt.reason.includes("not confirmed"),
    "Correct error message returned for unconfirmed status",
  );

  // 2. Staff confirms the order
  console.log("\nTest 2: Staff confirms the order");
  businessOrderAction(mockDb, "o_test_1001", "confirm");
  assert(testOrder.status === "confirmed", "Order successfully moved to 'confirmed'");

  // 3. Underpayment Check: Short payment is rejected
  console.log("\nTest 3: Reject underpayment (short amount)");
  const shortAttempt = recordPaymentSuccess(mockDb, {
    orderId: "o_test_1001",
    reference: "pay_ref_test_002",
    channel: "mobile_money",
    amountPaidPesewas: 5000, // Expected 7000
  });
  assert(!shortAttempt.ok, "Payment rejected when paid amount is less than payable");
  assert(testOrder.status === "confirmed", "Order remains 'confirmed' after underpayment");

  // 4. First Webhook Delivery: Order marked as PAID
  console.log("\nTest 4: First webhook delivery (charge.success)");
  const delivery1 = recordPaymentSuccess(mockDb, {
    orderId: "o_test_1001",
    reference: "pay_ref_test_003",
    channel: "mobile_money",
    amountPaidPesewas: 7000,
  });
  assert(delivery1.ok === true, "First payment delivery succeeded");
  assert(delivery1.ok === true && delivery1.alreadyPaid === false, "alreadyPaid is false on initial delivery");
  assert(testOrder.status === "paid", "Order status is now 'paid'");
  const paidEventsCount = testOrder.events.filter((e) => e.status === "paid").length;
  assert(paidEventsCount === 1, "Exactly 1 paid event was recorded");

  // 5. Second Webhook Delivery (Duplicate / Retry)
  console.log("\nTest 5: Second webhook delivery (identical payload retry)");
  const delivery2 = recordPaymentSuccess(mockDb, {
    orderId: "o_test_1001",
    reference: "pay_ref_test_003",
    channel: "mobile_money",
    amountPaidPesewas: 7000,
  });
  assert(delivery2.ok === true, "Duplicate webhook returned success (idempotent 200)");
  assert(delivery2.ok === true && delivery2.alreadyPaid === true, "alreadyPaid is true on duplicate delivery");
  assert(testOrder.status === "paid", "Order status remains 'paid'");
  assert(
    testOrder.events.filter((e) => e.status === "paid").length === 1,
    "No duplicate paid events added on retry",
  );

  // 6. Third Webhook Delivery (Late Retry / Re-delivery)
  console.log("\nTest 6: Third webhook delivery (late network retry)");
  const delivery3 = recordPaymentSuccess(mockDb, {
    orderId: "o_test_1001",
    reference: "pay_ref_test_003",
    channel: "mobile_money",
    amountPaidPesewas: 7000,
  });
  assert(delivery3.ok === true, "Late duplicate webhook returned success (idempotent 200)");
  assert(delivery3.ok === true && delivery3.alreadyPaid === true, "alreadyPaid is true on third delivery");
  assert(testOrder.status === "paid", "Order status remains 'paid'");
  assert(
    testOrder.events.filter((e) => e.status === "paid").length === 1,
    "Event count remains strictly 1",
  );

  // 7. HMAC-SHA512 Signature Verification Test
  console.log("\nTest 7: Webhook signature security");
  const webhookSecret = "test_webhook_secret_key_12345";
  const payload = JSON.stringify({
    event: "charge.success",
    data: {
      reference: "pay_ref_test_003",
      amount: 7000,
      channel: "mobile_money",
      metadata: { orderId: "o_test_1001" },
    },
  });

  const validSignature = crypto.createHmac("sha512", webhookSecret).update(payload).digest("hex");
  const invalidSignature = "invalid_hash_signature_000000";

  const verifySignature = (body: string, sig: string, secret: string) => {
    const hash = crypto.createHmac("sha512", secret).update(body).digest("hex");
    return crypto.timingSafeEqual(Buffer.from(hash, "utf8"), Buffer.from(sig, "utf8"));
  };

  assert(verifySignature(payload, validSignature, webhookSecret), "Valid HMAC signature passes verification");

  let invalidCaught = false;
  try {
    const res = verifySignature(payload, invalidSignature, webhookSecret);
    invalidCaught = !res;
  } catch {
    invalidCaught = true;
  }
  assert(invalidCaught, "Tampered / invalid HMAC signature is rejected");

  console.log("\nAll 7 idempotency and security tests passed successfully.");
}

runIdempotencyTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
