# Paystack Payment Gateway Integration

This document covers the Paystack Mobile Money and Card payment gateway integration for GoodCane (owned by Person C: Channels, WhatsApp & Money).

---

## 1. Overview

GoodCane uses Paystack to process pre-order payments in Ghana Cedis (GHS). Customers can pay using Ghana Mobile Money (MTN, Telecel, AT) or debit/credit cards.

* Adapter File: `src/lib/payments/paystack.ts`
* API Base: `https://api.paystack.co`
* Currency: `GHS`
* Subunit: Pesewas (`1 GHS = 100 pesewas`)
* Allowed Channels: `["mobile_money", "card"]`

---

## 2. Environment Variables

The gateway requires the following environment variables:

| Variable | Scope | Description |
|---|---|---|
| `PAYSTACK_SECRET_KEY` | Server-side | Paystack secret key (`sk_test_...` or `sk_live_...`) |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | Client-side | Paystack public key (`pk_test_...` or `pk_live_...`) |
| `PAYSTACK_WEBHOOK_SECRET` | Server-side | Webhook secret for verifying HMAC-SHA512 signatures (defaults to `PAYSTACK_SECRET_KEY`) |

---

## 3. Adapter Functions

### `initializeTransaction(input)`
Initializes a payment session on Paystack.

* **Input**:
  * `orderId` (string): Unique order ID.
  * `orderCode` (string): Customer-facing order code (e.g. `GC-1001`).
  * `amountInCedis` (number): Order total in GHS.
  * `customerPhone` (string): Ghana customer phone number.
  * `customerEmail` (string, optional): Email if provided; otherwise falls back to `{phone}@order.goodcane.co`.
  * `callbackUrl` (string, optional): Redirection URL after user completes checkout on Paystack.
* **Output**:
  * `authorizationUrl`: Hosted checkout URL to redirect the customer to.
  * `accessCode`: Paystack access code.
  * `reference`: Unique transaction reference (`gc_{orderCode}_{timestamp}`).

### `verifyTransaction(reference)`
Queries `GET https://api.paystack.co/transaction/verify/:reference` to verify transaction status.

* **Output**:
  * `success` (boolean): `true` if transaction status is `success`.
  * `amountInCedis` (number): Verified amount converted back from pesewas.
  * `channel` (string): E.g. `mobile_money` or `card`.
  * `paidAt` (string): ISO timestamp of successful payment.

### `verifyWebhookSignature(rawBody, signature)`
Validates that incoming Paystack webhook requests originated from Paystack using HMAC-SHA512 with timing-safe comparison.

---

## 4. Development Sandbox Mode

When `PAYSTACK_SECRET_KEY` is not configured and `NODE_ENV !== "production"`:
* `initializeTransaction` automatically returns a simulated authorization URL pointing to `/order/{orderId}?simulated_payment=success`.
* `verifyTransaction` recognizes references prefixed with `sim_` and returns a successful response without calling remote APIs.
* This ensures zero developer blocking during local development and testing.

---

## 5. API Endpoints

### `POST /api/payments/initialize`
Initiates a payment session for an order.

* **Authentication**: Public
* **Request Body**:
  ```json
  {
    "orderId": "o_xxx",
    "customerEmail": "customer@example.com", // optional
    "callbackUrl": "https://order.goodcane.co/order/o_xxx" // optional
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "authorization_url": "https://checkout.paystack.com/0123456789",
    "access_code": "0123456789",
    "reference": "gc_gc1001_1710000000000",
    "order_id": "o_xxx",
    "order_code": "GC-1001",
    "amount": 70,
    "is_deposit": false
  }
  ```
* **Status Rules**: Order must be in `confirmed` or `requested` status. If the cart contains Tigernut 2L or 4L, the payable amount is automatically calculated as a 50% non-refundable deposit.

### `POST /api/webhooks/paystack`
Receives webhook event notifications from Paystack.

* **Authentication**: HMAC-SHA512 header verification (`x-paystack-signature`)
* **Handled Events**:
  * `charge.success`: Extracts `metadata.orderId` and transitions the order status to `paid` with an event audit log.
* **Response (200 OK)**:
  ```json
  {
    "received": true,
    "orderId": "o_xxx",
    "status": "paid",
    "alreadyPaid": false
  }
  ```

---

## 6. UI Payment Flow & WhatsApp Integration

### Reusable Payment Component
* **Component**: `src/components/payment-button.tsx` (`<PaymentButton />`)
* **Order Status Page**: `src/app/order/[id]/status.tsx`
* **Trigger**: Dynamically renders when an order moves to `confirmed` status.
* **Deposit Awareness**: Detects large-format Tigernut items (2L or 4L) and displays a 50% deposit banner.
* **Real-time Polling**: Automatically polls `/api/orders/:id` every 4 seconds while awaiting payment completion.

### WhatsApp Link Builders
* **Module**: `src/lib/whatsapp.ts` and `src/lib/services/messaging.ts`
* **Collection Time Windows**:
  * Adenta Shop: Saturday 10:00 AM – 4:00 PM
  * Parks & Gardens: Saturday 9:00 AM – 2:00 PM (1st & 3rd Saturdays)
  * Green Butterfly Market: Saturday 10:00 AM – 3:00 PM
  * Delivery: Saturday 11:00 AM – 3:00 PM (Dispatch)
* **Payment Status**: Included in confirmation notes (`Paid in full via Mobile Money` vs. `Payment pending`).


