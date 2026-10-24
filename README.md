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
| `/business/login` | Demo passcode gate |
| `/business` | Next-batch demand, outlook, CSV export, reset |
| `/business/orders` | Orders list + actions, standing orders |
| `/business/reminders` | Approval queue + WhatsApp click-to-chat |
| `/business/metrics` | Pilot scorecard |

API (JSON): `GET /api/batch`, `POST /api/orders`, `GET /api/orders/[id]`, `POST /api/orders/[id]/reorder`, `POST /api/orders/[id]/cancel`, `POST /api/lookup`, `POST /api/standing/[id]` (`skip|unskip|pause|resume|cancel`), `POST /api/reminders/preferences`, and passcode-protected `/api/admin/*` (`overview`, `orders`, `orders/[id]` (`confirm|pay|cancel|notified`), `reminders`, `reminders/[id]` (`approve|dismiss|open`), `metrics`, `export`, `reset`, `login`, `logout`).

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
npm run build && PORT=3000 npm start &
BASE_URL=http://localhost:3000 SHOTS=e2e/shots npm run e2e   # needs Chrome; set CHROME_PATH if not /usr/bin/google-chrome
```

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel → **Add New Project** → import the repo (framework auto-detected: Next.js). No build settings needed.
3. Optional env vars (see `.env.example`): `DEMO_PASSCODE`, `NEXT_PUBLIC_GOODCANE_WHATSAPP` (leave the placeholder until GoodCane approves), `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct) for Neon Postgres, or Upstash/KV credentials for JSON persistence.
4. Deploy. Use **Reset demo data** on the Batch desk before recording a demo.

## Architecture

- Next.js 16 (App Router, Cache Components) + TypeScript + Tailwind CSS v4. Pages are client components calling small JSON route handlers.
- `src/lib/config.ts` — **all assumptions in one place**: batch weekday (Sat), cutoff (Thu 6pm), products/prices (*to confirm*), pickup points, delivery placeholders, forecast window, WhatsApp placeholder number. Person B owns this file after Phase 1.
- `src/lib/services/` — domain rules split by owner: `batch.ts` (sync, forecast, reminders), `orders.ts` (create/cancel/reorder), `customer.ts` (lookup, reminder opt-in), `payments.ts` (mark paid), plus Phase 3 stubs `capacity.ts` and `cron.ts`.
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
- **Phone lookup is not authentication**: anyone with a number could see that number's orders. A pilot should add an SMS/WhatsApp one-time code.
- The business passcode is a demo gate shown on screen.
- Times are Ghana time (UTC+0). Batch day/cutoff are assumptions until GoodCane confirms.
- WhatsApp: links only. Sample phone numbers are fake, so wa.me links for sample customers lead nowhere real.
- No payments, stock, capacity limits or delivery fees are modelled (all to confirm).

## Docs

- [docs/24_HOUR_SPRINT_PLAN.md](docs/24_HOUR_SPRINT_PLAN.md) — 24-hour sprint plan for 3 developers (concurrent setup, DB, auth/OTP, MoMo payments)
- [docs/WRITEUP.md](docs/WRITEUP.md) — customer problem, TikTok evidence, assumptions checklist, approach, rollout plan (incl. WhatsApp levels)
- [docs/MEASUREMENT.md](docs/MEASUREMENT.md) — metric definitions, formulas, hypotheses, 4-week pilot
- [docs/VIDEO_SCRIPT.md](docs/VIDEO_SCRIPT.md) — ~2 min demo shot list

Credits: product photos, names and brand cues from GoodCane's public TikTok (@goodcane.co), used for this prototype only.
