# Paystack payments

This document covers the Paystack Mobile Money and card gateway integration for GoodCane (Person C: Channels, WhatsApp & Money).

---

## 1. Environment

| Variable | Scope | Required | Purpose |
|---|---|---|---|
| `PAYSTACK_SECRET_KEY` | Server | Live and `next start` | Secret key (`sk_live_...` or `sk_test_...`). When unset outside production, simulated checkout is used. |
| `PAYSTACK_WEBHOOK_SECRET` | Server | No | HMAC key for webhook signature verification. Falls back to `PAYSTACK_SECRET_KEY`. |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | Client | No | Public key reserved for client checkout. |
| `NEXT_PUBLIC_APP_URL` | Server | No | Deployment URL. The initialize route uses the request origin for the return URL. |

---

## 2. API Endpoints

### `POST /api/payments/initialize`
Public endpoint. Starts Mobile Money or card checkout for a confirmed order.

* **Request**:
  ```json
  { "orderId": "o_xxx", "customerEmail": "customer@example.com" }
  ```
  `callbackUrl` is built server-side as `${origin}/order/${orderId}` and cannot be forged by the client.

* **Response (200 OK)**:
  ```json
  {
    "authorization_url": "https://checkout.paystack.com/...",
    "access_code": "0123456789",
    "reference": "gc_gc1001_1710000000000",
    "order_id": "o_xxx",
    "order_code": "GC-1001",
    "amount": 90,
    "total": 180,
    "is_deposit": true
  }
  ```

* **Rules**:
  * The order must be in `confirmed` status. Orders with `requested`, `paid`, or `cancelled` status return HTTP 409.
  * If the cart contains large-format made-to-order Tigernut (2L or 4L), `amount` is set to half of `total` (pesewa-rounded) and `is_deposit` is `true`.
  * In development mode without `PAYSTACK_SECRET_KEY`, `authorization_url` returns `/order/{orderId}?simulated_payment=success&reference=sim_...` for zero developer blocking.

### `POST /api/webhooks/paystack`
Receives Paystack charge event notifications.

* **Signature**: Header `x-paystack-signature` verified using HMAC-SHA512.
* **Double Verification**: Validated events are cross-checked with `GET /transaction/verify/:reference`.
* **Rules**:
  * `charge.success` marks the order `paid` if verified currency is `GHS` and amount in pesewas covers the payable.
  * Idempotent: already-paid orders return `{ "received": true, "applied": true, "alreadyPaid": true }` without duplicating events.
  * Short payments, cancelled orders, or non-confirmed orders return HTTP 200 with `{ "received": true, "applied": false, "reason": "..." }`.

---

## 3. UI Flow & Component

* **Component**: `src/components/payment-button.tsx` (`<PaymentButton />`)
* **Order Status View**: `src/app/order/[id]/status.tsx`
* **Visibility**: The Mobile Money button displays only when the order status is `confirmed`.
* **Real-time Polling**: While in `confirmed` status, the order page polls every 4 seconds to detect payment completion.
* **Deposit Notice**: Displays whether an order required a deposit or is paid in full.
