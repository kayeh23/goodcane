# Paystack payments

Person C owns this flow. It is on `main` with the checks below. Orders are still stored through `mutate()` until `feat/A-database-engine` merges.

## Environment

| Variable | Required | Purpose |
|---|---|---|
| `PAYSTACK_SECRET_KEY` | Live and `next start` | Secret key. When unset, `next dev` simulates checkout. |
| `PAYSTACK_WEBHOOK_SECRET` | No | HMAC key. Falls back to `PAYSTACK_SECRET_KEY`. |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | No | Reserved for a client checkout. The current button uses the server redirect. |
| `NEXT_PUBLIC_APP_URL` | No | Documented for deploys. The initialize route uses the request origin for the return URL. |

## `POST /api/payments/initialize`

Public. No staff session.

Request:

```json
{ "orderId": "ord_...", "customerEmail": "optional@example.com" }
```

`callbackUrl` in the body is ignored. Paystack is given `{origin}/order/{orderId}`.

Response `200`:

```json
{
  "authorization_url": "https://checkout.paystack.com/...",
  "access_code": "...",
  "reference": "gc_gc1001_1710000000000",
  "order_id": "ord_...",
  "order_code": "GC-1001",
  "amount": 90,
  "total": 180,
  "is_deposit": true
}
```

The order must be `confirmed`. `requested`, `paid`, and `cancelled` return `409`. Tigernut 2L or 4L sets `amount` to half of `total` (pesewa-rounded) and `is_deposit` to `true`.

Missing `orderId` returns `400` `{ "error": "Missing required parameter: orderId." }`.

With no `PAYSTACK_SECRET_KEY` outside production, `authorization_url` is `/order/{orderId}?simulated_payment=success&reference=sim_...` and no Paystack call is made. Production without the key returns an error and does not simulate.

## `POST /api/webhooks/paystack`

Paystack sends the raw JSON body and `x-paystack-signature` (HMAC-SHA512 of that body).

* Signature is required whenever `PAYSTACK_SECRET_KEY` or `PAYSTACK_WEBHOOK_SECRET` is set, including in development.
* With no secret, only `NODE_ENV !== "production"` and a reference starting with `sim_` is accepted. That is the local simulated checkout.
* `charge.success` with a valid signature is verified again with `GET /transaction/verify/:reference`. The order id and amount come from that verified charge. Currency must be `GHS`.
* The order is marked `paid` only when it is `confirmed` and the amount in pesewas covers the payable (full total, or the 50% deposit).
* Already-paid orders return `applied: true` and `alreadyPaid: true` without a second event.
* A short payment, a cancelled order, or any status other than `confirmed` returns `200` with `applied: false` and a `reason`, and does not change the order.
* Other event names return `{ "received": true, "ignored": true }`.
* A bad signature returns `401`. A verify call that fails returns `502` so Paystack can retry.

## Customer page

`/order/[id]` shows the Mobile Money button only while the order is `confirmed`. The button posts `{ orderId }` only. While that status lasts, the page reloads the order every 4 seconds. A deposit is labelled as a deposit, including after it is recorded. The desk can still mark a confirmed order paid manually.

WhatsApp confirmation text includes whether payment was received. It does not include pickup clock times; those hours are still unconfirmed in `src/lib/config.ts`.
