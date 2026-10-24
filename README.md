# GoodCane · Weekly batch pre-orders (prototype)

A mobile-first web prototype that helps **GoodCane** (fresh sugarcane & tigernut-coconut juice, Accra · TikTok [@goodcane.co](https://www.tiktok.com/@goodcane.co)) turn product discovery into **repeat orders** and **predictable weekly demand**.

> **Demo — sample data.** Every customer, order, reminder and number in this app is fictional and labelled *Sample*. Prices, pickup points and product names come from GoodCane's public TikTok and are marked *to confirm*. There are **no live payments** and **no automatic messages** — WhatsApp is click-to-chat only (a person presses Send).

## What it does

**Customer (mobile web)**
1. Opens the link (from TikTok bio / WhatsApp) → sees the **next fresh batch** date and **order cutoff** countdown.
2. Picks drinks, sizes and quantities (4 sugarcane flavours 330ml; Tigernut-Coconut 330ml/500ml/2L/4L, made to order).
3. Chooses a **pickup point** (Adenta shop, Parks & Gardens on 1st/3rd Saturdays, Green Butterfly Market) or **delivery** (placeholder areas).
4. Enters **name + phone only**; optionally ticks **reminders** (opt-in) and **repeat weekly** (standing order request).
5. Order is saved as a **REQUEST**. Optional **"Send to GoodCane on WhatsApp"** button opens a prefilled wa.me message.
6. Comes back to **My orders** (phone lookup, remembered on the device) → **one-tap Reorder**, cancel before cutoff, **skip this week / pause / resume / cancel** a standing order, turn reminders off.

**Business (“Batch desk”, passcode-gated)**
- **Overview**: next-batch demand by product & size split **Requested / Confirmed / Paid**, prep plan in litres, standing-order summary, **4-batch demand outlook** (standing orders + moving average, method shown), **CSV export**, **Reset demo data**.
- **Packing**: Saturday pack sheet grouped by Adenta / Parks & Gardens / Green Butterfly / Delivery Dispatch, with Bottled → Packed → Collected. Empty tables still render when Neon has no confirmed or paid orders.
- **Orders**: filters (batch, status, source) with **Confirm / Decline / Mark paid / Cancel**, optional **Notify on WhatsApp** (prefilled confirmation), and a standing-orders tab.
- **Reminders**: queue drafted for opted-in recent customers. **Approve → “Open in WhatsApp” unlocks → business presses Send manually**; status becomes *Opened in WhatsApp (business sends manually)*.
- **Metrics**: repeat-order rate, confirmed weekly orders, cancellation rate, forecast accuracy (1 − MAPE vs snapshotted forecasts), reminder conversion, opt-in rate — over 8 weeks of sample history.

Order lifecycle: `REQUEST → CONFIRMED → PAID` (paid is marked manually), or `CANCELLED` (by customer before cutoff, or by GoodCane).

## Demo passcode

`goodcane-demo` (shown on the login screen; override with `DEMO_PASSCODE`). Demo-only gate — a pilot needs real staff accounts.

Sample customer phones to try in **My orders**: `020 000 0001` (standing order, paid this week), `020 000 0005` (standing order awaiting confirmation), `020 000 0013` (one-off buyer with a reminder pending). All are fake placeholders.

## Routes

| Route | What |
|---|---|
| `/` | Shop: next batch, cutoff countdown, drinks |
| `/checkout` | Pickup/delivery, name + phone, opt-ins, privacy note |
| `/order/[id]` | Order status (Request → Confirmed → Paid), WhatsApp share |
| `/my-orders` | Phone lookup, one-tap reorder, standing order controls, reminder toggle |
| `/business/login` | Staff username and password |
| `/business` | Next-batch demand, outlook, CSV export, reset |
| `/business/packing` | Kitchen pack sheet by fulfillment table |
| `/business/orders` | Orders list + actions, standing orders |
| `/business/reminders` | Approval queue + WhatsApp click-to-chat |
| `/business/metrics` | Pilot scorecard |

API (JSON): `GET /api/batch`, `POST /api/orders` (409 when the batch is at capacity), `GET /api/orders/[id]`, `POST /api/orders/[id]/reorder`, `POST /api/orders/[id]/cancel`, `POST /api/lookup`, `POST /api/standing/[id]` (`skip|unskip|pause|resume|cancel`), `POST /api/reminders/preferences`. `GET`/`POST /api/cron/sync` runs cutoff auto-cancel plus standing-order/reminder sync; production requires `Authorization: Bearer CRON_SECRET`.

Staff session: `POST /api/auth/login` `{ username, password }` → `{ ok: true }` and cookie `goodcane_staff`; `POST /api/auth/logout` → `{ ok: true }`; `GET /api/auth/me` → `{ username, role }` or 401. Customer OTP: `POST /api/auth/otp/send` `{ phone }` → `{ ok: true }` (429 when limited); `POST /api/auth/otp/verify` `{ phone, code }` → `{ ok: true }` and cookie `goodcane_customer`. The OTP cookie stores `233XXXXXXXXX`. `requireCustomer` (lookup, checkout orders, my-orders APIs, Paystack initialize) maps that to local `0XXXXXXXXX` so it matches customer rows in Postgres.

Payments: `POST /api/payments/initialize` `{ orderId, customerEmail? }` → `{ authorization_url, access_code, reference, order_id, order_code, amount, total, is_deposit }` for a **confirmed** order. `POST /api/webhooks/paystack` is the Paystack `charge.success` body with header `x-paystack-signature`. See [docs/PAYMENTS.md](docs/PAYMENTS.md).

Staff-only `/api/admin/*`: `overview`, `orders`, `orders/[id]` (`confirm|pay|cancel|notified|pack_stage`), `packing`, `reminders`, `reminders/[id]` (`approve|dismiss|open`), `metrics`, `export`, `reset`. These routes require the staff session. They do not accept the old passcode cookie. `GET /api/admin/export?batch=YYYY-MM-DD` downloads `goodcane-batch-{date}.csv` from the live store (Postgres when `DATABASE_URL` is set). A failed desk fetch shows an error, not an infinite Loading state.

## Run locally

```bash
npm install
npm run dev            # http://localhost:3000
# or production mode
npm run build && npm start
```

Postgres on Neon (production branch of project `soft-block-48919425`):

```bash
# DATABASE_URL (pooled) and DATABASE_URL_UNPOOLED are written to .env by `neon env pull`.
npm run db:push
# or, against the direct connection:
psql "$DATABASE_URL_UNPOOLED" -f drizzle/0000_init.sql
```

End-to-end check (places an order, confirms, marks paid, reorders by phone, skips/cancels a standing order, approves a reminder and opens WhatsApp, exports CSV) with screenshots:

```bash
# SESSION_SECRET must be 32+ characters for `next start`. Use the same DEV_STAFF_PASSWORD for the server and the test.
SESSION_SECRET=$(openssl rand -hex 32) DEV_STAFF_PASSWORD=dev-only npm run build && PORT=3000 npm start &
BASE_URL=http://localhost:3000 DEV_STAFF_PASSWORD=dev-only SHOTS=e2e/shots npm run e2e   # needs Chrome; set CHROME_PATH if not /usr/bin/google-chrome
```

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel → **Add New Project** → import the repo (framework auto-detected: Next.js). No build settings needed.
3. Env vars (see `.env.example`): `SESSION_SECRET`, `CRON_SECRET` (Vercel Cron for `/api/cron/sync`), `DEV_STAFF_PASSWORD` (only if `staff_users` has no row for that username), `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct) for Neon Postgres, `NEXT_PUBLIC_GOODCANE_WHATSAPP` (leave the placeholder until GoodCane approves), Paystack keys when taking live payments, and Upstash/KV credentials for JSON persistence.
4. Deploy. Use **Reset demo data** on the Batch desk before recording a demo.

## Architecture

- Next.js 16 (App Router, Cache Components) + TypeScript + Tailwind CSS v4. Pages are client components calling small JSON route handlers.
- `src/lib/config.ts` — **all assumptions in one place**: batch weekday (Sat), cutoff (Thu 6pm), products/prices (*to confirm*), pickup points, delivery placeholders, forecast window, WhatsApp placeholder number. Person B owns this file after Phase 1.
- `src/lib/services/` — domain rules split by owner: `batch.ts` (sync, forecast, reminders), `orders.ts` (create/cancel/reorder), `customer.ts` (lookup, reminder opt-in), `payments.ts` (mark paid, deposit, Paystack apply), `capacity.ts` (150L batch cap, to confirm), `cron.ts` (cutoff auto-cancel + scheduled sync).
- `src/lib/auth/` — staff iron-session, Ghana phone OTP, rate limit. `src/proxy.ts` sends unsigned `/business` and `/api/admin` requests to sign-in.
- `src/lib/payments/paystack.ts` — Paystack initialize, verify, and webhook signature.
- `src/lib/db/` — repository contract (`getOrder`, `createOrder`, `listBatchOrders`, `mutate`, `getStaffByUsername`). Drizzle schema in `schema.ts`. Set `DATABASE_URL` (pooled Neon / `pg`) to use Postgres; otherwise the JSON store is used. Drizzle Kit uses `DATABASE_URL_UNPOOLED`.
- `src/lib/analytics.ts` — dashboard, metrics, CSV.
- `src/lib/seed.ts` — deterministic labelled sample data (28 sample customers, 8 past batches + current).
- `src/lib/store/index.ts` — in-memory / Upstash JSON document used when `DATABASE_URL` is unset.
- `src/lib/whatsapp.ts` — wa.me link builders (no API). Person C owns this file after Phase 1.
- `src/lib/errors.ts` — shared `AppError` for JSON API handlers.
- `src/lib/types.ts` — frozen domain types. Change only via a shared PR.

### Storage & known limitations

- **Default store is in-memory**, seeded with sample data on cold start. Zero setup on Vercel, but data **resets when the instance restarts**, and concurrent serverless instances may hold different copies. Good enough for a demo video; not for a pilot.
- Set `DATABASE_URL` (pooled) and apply `drizzle/0000_init.sql` (or `npm run db:push`, which uses `DATABASE_URL_UNPOOLED`) to persist customers, orders, standing_orders, reminders, forecasts, and `staff_users` in Neon Postgres. Existing API handlers still call `mutate()`; the repo hydrates the domain document from tables so B/C do not wait on a SQL rewrite.
- Set `UPSTASH_REDIS_REST_URL`/`TOKEN` (or `KV_REST_API_URL`/`TOKEN`) to persist the same JSON document in Upstash Redis when Postgres is not ready.
- Customer order APIs require the OTP cookie. Lookup ignores the request body and uses the session phone after `normalisePhone`.
- The batch desk requires the staff session. With `DATABASE_URL` set, login reads `staff_users` via `getStaffByUsername`. `DEV_STAFF_PASSWORD` is used only when that row is missing, and it is ignored when `VERCEL_ENV=production`.
- Times are Ghana time (UTC+0). Batch day/cutoff are assumptions until GoodCane confirms.
- WhatsApp: links only. Sample phone numbers are fake, so wa.me links for sample customers lead nowhere real.
- Paystack marks a confirmed order paid when the verified charge covers the payable amount (full total, or 50% for Tigernut 2L/4L). A batch is capped at 150 litres (to confirm); `POST /api/orders` returns 409 when full. Unconfirmed requests are cancelled at cutoff by `/api/cron/sync` (hourly on Vercel) and on the next API request. Delivery fees are still to confirm. Pickup clock times are not in WhatsApp messages until GoodCane confirms them.

## Docs

- [docs/24_HOUR_SPRINT_PLAN.md](docs/24_HOUR_SPRINT_PLAN.md) — 24-hour sprint plan for 3 developers (concurrent setup, DB, auth/OTP, MoMo payments)
- [docs/PACKING.md](docs/PACKING.md) — Kitchen pack sheet guide for Saturday batch operations and location tables
- [docs/PAYMENTS.md](docs/PAYMENTS.md) — Paystack Mobile Money & Card gateway integration guide
- [docs/WRITEUP.md](docs/WRITEUP.md) — customer problem, TikTok evidence, assumptions checklist, approach, rollout plan (incl. WhatsApp levels)
- [docs/MEASUREMENT.md](docs/MEASUREMENT.md) — metric definitions, formulas, hypotheses, 4-week pilot
- [docs/VIDEO_SCRIPT.md](docs/VIDEO_SCRIPT.md) — ~2 min demo shot list

Credits: product photos, names and brand cues from GoodCane's public TikTok (@goodcane.co), used for this prototype only.
