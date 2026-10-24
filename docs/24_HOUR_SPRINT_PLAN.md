# 24-Hour Sprint Implementation Plan: GoodCane Production Launch

This plan is optimized for a **24-hour sprint** with 3 developers working concurrently on Git without merge collisions or blocking dependencies.

---

## Sprint Schedule Overview (T-0 to T-24)

```
[T00:00 - T02:00]  PHASE 1: Repo Setup, CI/CD & Service Modularization (Zero Merge Conflicts)
[T02:00 - T08:00]  PHASE 2: Core Foundations (DB Engine, Staff Auth/OTP, MoMo Gateway)
[T08:00 - T14:00]  PHASE 3: Business Logic & Feature Wiring (Capacity, Customer Portal, Webhooks)
[T14:00 - T18:00]  PHASE 4: Integration & Synchronization (Cross-Merging & Service Wiring)
[T18:00 - T21:00]  PHASE 5: Hardening, PII Protection & Kitchen Pack Sheets
[T21:00 - T23:00]  PHASE 6: End-to-End Testing & Simulated Batch Run
[T23:00 - T24:00]  PHASE 7: Production Release & Smoke Tests
```

---

## Developer Ownership & Strict File Boundaries

To prevent file collision during concurrent branch development:

| Developer | Domain | Exclusive File Ownership | Shared / Read Only |
|---|---|---|---|
| **Person A** | **Platform & Kitchen Ops** | `src/lib/db/**`, `src/lib/services/batch.ts`, `src/lib/services/capacity.ts`, `src/lib/services/cron.ts`, `src/app/api/admin/**`, `src/app/api/cron/**`, `src/app/business/(desk)/**`, CI, `vercel.json` | `src/lib/types.ts` |
| **Person B** | **Trust, Auth & Catalogue** | `src/lib/auth/**`, `src/lib/services/customer.ts`, `src/lib/services/catalogue.ts`, `src/lib/config.ts`, `src/app/business/login/**`, `src/app/checkout/**`, `src/app/my-orders/**`, `src/app/api/auth/**`, `src/app/api/lookup/**`, `src/app/shop.tsx` | `src/lib/types.ts` |
| **Person C** | **Channels, WhatsApp & Money** | `src/lib/payments/**`, `src/lib/services/payments.ts`, `src/lib/services/messaging.ts`, `src/lib/whatsapp.ts`, `src/app/api/payments/**`, `src/app/api/webhooks/**`, `src/app/order/[id]/**`, `src/components/whatsapp-button.tsx` | `src/lib/types.ts` |

---

## Phase 1: Repo Setup, CI/CD & Modularization (Hours 0 – 2)

**Goal:** Establish the repo, branch protections, CI, and eliminate merge conflicts by splitting `service.ts` before feature branches diverge.

**Status:** Step 1.1 done (`main` on origin). Step 1.2 done (existing workflow [`.github/workflows/ci-cd.yml`](../.github/workflows/ci-cd.yml) — do not add a second `ci.yml`). Step 1.3 done in code (`src/lib/service.ts` removed). **STOP for B and C until this is merged to `main`**, then they `git pull origin main` and open `feat/B-auth-and-otp` and `feat/C-payments-gateway`. Person A then starts Phase 2 on `feat/A-database-engine`.

### Phase 1 handoff (B and C may start after `main` has this split)

- **Person B owns:** `src/lib/auth/**` (create), `src/lib/services/customer.ts`, `src/lib/services/catalogue.ts` (create if needed), `src/lib/config.ts`, `src/app/business/login/**`, `src/app/checkout/**`, `src/app/my-orders/**`, `src/app/api/auth/**`, `src/app/api/lookup/**`, `src/app/shop.tsx`.
- **Person C owns:** `src/lib/payments/**` (create), `src/lib/services/payments.ts`, `src/lib/services/messaging.ts` (create if needed), `src/lib/whatsapp.ts`, `src/app/api/payments/**`, `src/app/api/webhooks/**`, `src/app/order/[id]/**`, `src/components/whatsapp-button.tsx`.
- **Shared read-only:** `src/lib/types.ts`. Do not add fields without a tiny shared PR.
- **Do not edit:** `src/lib/db/**`, `src/lib/services/batch.ts`, `src/lib/services/capacity.ts`, `src/lib/services/cron.ts`, `src/app/api/admin/**`, `src/app/api/cron/**`, `src/app/business/(desk)/**`.

### Step 1.1: Git & Repository Setup (Lead / Person A)
```bash
# Initialize and push to organization
git init
git add .
git commit -m "chore: initial commit of GoodCane prototype base"
git branch -M main
git remote add origin https://github.com/<org>/goodcane.git
git push -u origin main
```

**Branch Protection Rules for `main`:**
* Require Pull Request with 1 approval.
* Require status checks to pass (`lint`, `build`).
* Disallow force pushes and direct commits.

### Step 1.2: CI Pipeline Setup (Person A)
Create `.github/workflows/ci.yml`:
```yaml
name: CI
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run build
```

### Step 1.3: Immediate Modularization of `service.ts` (CRITICAL)
To prevent all 3 developers from conflicting on `src/lib/service.ts`, Person A immediately refactors `src/lib/` on `main` before anyone branches:

```
src/lib/
├── types.ts              <-- Core domain types (frozen contracts)
├── errors.ts             <-- Shared AppError
├── config.ts             <-- Config, pricing, pickup spots (Person B)
├── dates.ts              <-- Timezone & cutoff utilities
├── services/
│   ├── batch.ts          <-- Person A: sync, forecast, reminder queue
│   ├── capacity.ts       <-- Person A: stub (enforced in Phase 3)
│   ├── cron.ts           <-- Person A: stub (hourly route in Phase 3)
│   ├── customer.ts       <-- Person B: lookup, reminder opt-in
│   ├── orders.ts         <-- Shared/Person B: createOrder, cancel, reorder, confirm
│   └── payments.ts       <-- Person C: markPaid (webhook in Phase 2+)
└── db/                   <-- Person A: repo wrapping JSON store until Postgres
```

All 3 developers execute `git pull origin main` once this commit lands.

---

## Phase 2: Core Foundations (Hours 2 – 8)

| Developer | Branch | Primary Objective |
|---|---|---|
| **Person A (Platform)** | `feat/A-database-engine` | PostgreSQL schema, Drizzle/Prisma setup, connection pooling |
| **Person B (Trust)** | `feat/B-auth-and-otp` | NextAuth/Iron-session for staff, Arkesel/Hubtel SMS OTP client |
| **Person C (Channels)** | `feat/C-payments-gateway` | Paystack/Hubtel MoMo checkout API client + webhook endpoint |

### Status (return to this plan)

Phase 1 is on `main`. This branch is Person A's Phase 2 database engine with those `main` fixes merged in. **STOP after this push** — do not start capacity, cron, or packing (Phase 3/5).

**Person A status:** Schema, Drizzle client (pooled `pg` on `DATABASE_URL`), `staff_users`, and repo methods are in `src/lib/db`. Neon project `soft-block-48919425` branch `production` is linked (`.neon`, `neon.ts`). If `DATABASE_URL` is unset, the JSON store still runs. Schema is applied with `npm run db:push` (direct `DATABASE_URL_UNPOOLED`). Paystack's paid update goes through `mutate()`, which writes Postgres when `DATABASE_URL` is set.

* **Person B:** `/api/admin/*` and the batch desk accept only the `goodcane_staff` iron-session. The demo passcode cookie does not authorize those routes, and desk logout calls `POST /api/auth/logout`. A wrong OTP guess keeps the original 5-minute TTL. `.env.example` has placeholders, not a session key or password. `findStaffByUsername` reads `getStaffByUsername()` first. `DEV_STAFF_PASSWORD` applies only when that row is missing, and it is ignored when `VERCEL_ENV=production`.
* **Person C:** Paystack initialize, webhook, and the Mobile Money button are included. Payment starts only for `confirmed` orders. The webhook requires `x-paystack-signature` whenever a Paystack secret is set, then re-checks the charge with Paystack and refuses short, cancelled, or unconfirmed payments. The server builds the return URL. A 50% Tigernut 2L/4L deposit is not described as paid in full. Guessed pickup clock times were not copied in; catalogue hours are still unconfirmed. "Open in WhatsApp" on the desk already logs `opened_whatsapp` via `reminderAction` in `src/lib/services/batch.ts`.

### Person A Tasks (Hours 2 – 8)
1. Provision cloud PostgreSQL (Supabase / Neon / AWS RDS).
2. Install ORM: `npm i drizzle-orm pg @types/pg` + `npm i -D drizzle-kit`.
3. Create database tables in `src/lib/db/schema.ts` matching existing entities:
   * `customers` (`id`, `name`, `phone`, `reminders_opt_in`, `created_at`)
   * `orders` (`id`, `code`, `customer_id`, `batch_date`, `items_json`, `fulfilment_json`, `status`, `source`, `total`)
   * `standing_orders` (`id`, `customer_id`, `items_json`, `status`, `skip_batches`)
   * `reminders` (`id`, `customer_id`, `batch_date`, `status`, `message`)
   * `staff_users` (`id`, `username`, `password_hash`, `role`)
4. Implement standard Repository methods in `src/lib/db/repo.ts` (`getOrder`, `createOrder`, `listBatchOrders`).

### Person B Tasks (Hours 2 – 8)
1. Build Staff Authentication in `src/lib/auth/staff.ts`:
   * Use session cookies (`iron-session`).
   * Add login endpoint `/api/auth/login` (verify username & bcrypt password against `staff_users`).
   * Protect all `/api/admin/*` routes with session verification middleware.
2. Build Ghana SMS OTP Service in `src/lib/auth/otp.ts`:
   * Provider: Arkesel API (`https://sms.arkesel.com/api/v2/sms/send`) or Hubtel.
   * `sendOTP(phone)`: Generate 4-digit code, store in Redis/DB with 5-minute expiry.
   * **Dev Fallback:** If `NODE_ENV === "development"`, log the OTP code to terminal (`console.log`) so development is never blocked.
3. Build `/api/auth/otp/send` and `/api/auth/otp/verify`.

### Person C Tasks (Hours 2 – 8)
1. Set up Paystack Gateway Adapter in `src/lib/payments/paystack.ts`:
   * API: `POST https://api.paystack.co/transaction/initialize`
   * Currency: `GHS`, Channels: `["mobile_money", "card"]`.
   * Metadata: `{ orderId, orderCode, customerPhone }`.
2. Create Payment Initiation Endpoint `/api/payments/initialize`:
   * Receives `orderId`, validates order status is `confirmed` or `requested`.
   * Returns `{ authorization_url, access_code, reference }`.
3. Scaffold Webhook Listener `/api/webhooks/paystack`:
   * Verify HMAC signature (`crypto.createHmac('sha512', secret).update(body).digest('hex')`).
   * Check event: `charge.success`.

---

## Phase 3: Business Logic & Feature Wiring (Hours 8 – 14)

**Person A status:** Capacity (150L, to confirm) and `/api/cron/sync` + `vercel.json` hourly cron are implemented. Standing-order sync skips a line that would overflow instead of 409ing the whole API. **STOP after this PR** — do not start packing (Phase 5) in the same branch.

### Person A: Batch Capacity & Background Sync
1. **Capacity Guard (`src/lib/services/capacity.ts`):**
   * Before creating an order, query `SUM(units)` for the batch.
   * If total liters $\ge$ batch limit (e.g. 150L), throw HTTP 409 "Batch is at full capacity".
2. **Scheduled Sync Worker (`src/app/api/cron/sync/route.ts`):**
   * Configured via `vercel.json` crons (runs hourly).
   * Actions:
     * Check cutoff time: if `now >= cutoff` and orders are still `requested`, update to `cancelled` (`reason: "Unconfirmed at cutoff"`).
     * Instantiate orders for active `standing_orders` for next week.
     * Generate reminder drafts for eligible customers.

### Person B: Customer Portal (`/my-orders`) & Checkout Lock
1. **Update `/checkout`:**
   * Integrate confirmed pickup locations and delivery areas.
   * Add Ghana Data Protection Act (Act 843) consent badge: *"Your phone number is used solely to coordinate your juice delivery. We never share your data."*
2. **Secure `/my-orders`:**
   * Require phone number + OTP verification modal before revealing order history.
   * Wire customer order actions: `Cancel order` (disabled after Thursday 6pm cutoff or after payment).
   * Wire standing order actions: `Skip next batch`, `Pause`, `Cancel`.

### Person C: Order Status Payment Flow & WhatsApp Templates
1. **Update `/order/[id]` Status View:**
   * Add dynamic **"Pay with Mobile Money (GH₵)"** CTA button when order status is `confirmed`.
   * Redirect to Paystack checkout or trigger direct USSD push prompt.
   * Add real-time polling or toast notifications for status updates once paid.
2. **Large-Format Deposit Requirement:**
   * In `src/lib/services/orders.ts`: If cart contains Tigernut 2L or 4L, enforce 50% non-refundable deposit.
3. **Refine WhatsApp Link Builders:**
   * Update message templates in `src/lib/whatsapp.ts` with confirmed business number (`NEXT_PUBLIC_GOODCANE_WHATSAPP`).
   * Include exact pickup time windows and payment confirmation status.

---

## Phase 4: Integration & Synchronization (Hours 14 – 18)

**Person A status:** B/C PRs are on `main`. Wiring leftover: OTP session `233XXXXXXXXX` vs DB `0XXXXXXXXX` — `requireCustomer` now returns `normalisePhone(session)` so customers can load their own orders. **STOP** — do not start Phase 5 packing/export in this branch.

**Check-in Milestone (Hour 14):** Merge all feature branches into `main`.

```bash
# Person A reviews and merges B and C PRs
git checkout main
git pull origin main
git merge origin/feat/A-database-engine
git merge origin/feat/B-auth-and-otp
git merge origin/feat/C-payments-gateway
```

### Cross-System Wiring Tasks:
* **Person A & B:** Connect staff session credentials to the actual `staff_users` table created by Person A. Ensure `/business/*` redirects unauthenticated users to `/business/login`.
* **Person A & C:** Connect the Paystack webhook handler to update order status to `paid` using Person A's database transaction.
* **Person B & C:** Test customer checkout with OTP $\rightarrow$ payment initiation $\rightarrow$ status transition.

---

## Phase 5: Hardening & Kitchen Operations (Hours 18 – 21)

**Person A status:** Packing UI already shipped (PR #7). This branch does not rebuild it. CSV export uses the live store filename `goodcane-batch-{date}.csv`. Empty Neon still lists the next batch and the four packing tables. Desk pages use `DeskQueryStatus` so a failed `/api/admin/*` fetch is an error, not infinite Loading. **STOP after this PR** — Person B (phone mask, OTP rate limit, hide demo chrome) and Person C (WhatsApp log, payment error copy) stay on their branches.

### Person A (Platform)
* **Kitchen Pack Sheet View:** Create `/business/packing`:
  * Group confirmed & paid bottles by fulfillment location:
    * *Adenta Shop Table*
    * *Parks & Gardens Table*
    * *Green Butterfly Table*
    * *Delivery Dispatch Table*
  * Checkbox toggle for staff: `[ ] Bottled -> [ ] Packed -> [ ] Collected`.
* **Export Updates:** Ensure `/api/admin/export` exports real database orders to CSV.

### Person B (Trust & Security)
* **Phone Masking:** Update staff desk UI to mask customer phones (`024 *** *100`) by default, with a "Show" button for authorized staff.
* **Rate Limiting:** Protect `/api/auth/otp/send` with `@upstash/ratelimit` (max 3 SMS requests per phone per 10 minutes to prevent SMS billing abuse).
* **Environment Scrubbing:** Ensure all demo data buttons and fake customer indicators are hidden when `NODE_ENV === "production"`.

### Person C (Channels & Ops)
* **WhatsApp Desk Actions:** Connect `/business/reminders` so tapping "Open in WhatsApp" logs the message as `opened_whatsapp` in the database.
* **SMS Error Handling:** Ensure friendly UI error messages when a customer enters an invalid Ghana phone number or payment fails.

---

## Phase 6: End-to-End Testing & Simulation (Hours 21 – 23)

Run a complete simulated weekly batch cycle on staging:

```mermaid
sequenceDiagram
    autonumber
    actor Customer
    actor Staff
    participant Web as Web App
    participant Pay as Paystack
    participant DB as Postgres DB

    Customer->>Web: Places Pre-order (Raw + Tigernut 500ml)
    Web->>DB: Save Order as 'requested'
    Staff->>Web: Opens Batch Desk & taps 'Confirm'
    Web->>DB: Update Status to 'confirmed'
    Customer->>Web: Clicks 'Pay with MoMo'
    Web->>Pay: Initialize Transaction
    Customer->>Pay: Completes MoMo prompt on phone
    Pay->>Web: Webhook 'charge.success'
    Web->>DB: Atomic Update Order to 'paid'
    Staff->>Web: Opens Kitchen Pack Sheet -> Marks 'Bottled'
    Staff->>Web: Taps 'Open in WhatsApp' -> Collection notice sent
```

1. **Automated E2E:** Run updated Playwright test suite:
   ```bash
   BASE_URL=https://staging.goodcane.co npm run e2e
   ```
2. **MoMo Webhook Test:** Trigger Paystack test webhooks via CLI to ensure idempotency.
3. **Cutoff Simulation:** Advance the clock past Thursday 6pm and trigger `/api/cron/sync` to verify auto-cancellation of unconfirmed requests.

---

## Phase 7: Production Release & Handoff (Hours 23 – 24)

### Production Checklist
1. **Vercel Production Deployment:**
   * Link production branch (`main`) to Vercel production domain (`order.goodcane.co` or similar).
2. **Environment Variables Configuration:**

```env
# Node / Core
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://order.goodcane.co

# Database (Person A)
DATABASE_URL=postgresql://user:pass@ep-host.pooler.region.neon.tech/goodcane?sslmode=require

# Authentication & Rate Limiting (Person B)
SESSION_SECRET=min_32_character_random_string_for_iron_session
UPSTASH_REDIS_REST_URL=https://your-upstash.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token

# SMS Gateway (Person B)
ARKESEL_API_KEY=your_arkesel_key
SMS_SENDER_ID=GoodCane

# Payments (Person C)
PAYSTACK_SECRET_KEY=sk_live_xxxx
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_live_xxxx
PAYSTACK_WEBHOOK_SECRET=your_paystack_webhook_secret

# Channels (Person C)
NEXT_PUBLIC_GOODCANE_WHATSAPP=233500000000 # Confirmed GoodCane WhatsApp Number
```

3. **Smoke Test:**
   * Place 1 real GH₵1.00 test order on production.
   * Complete MoMo payment with real mobile money wallet.
   * Verify order transitions to `PAID` on the Batch Desk.
   * Cancel and refund the test order.

---

## Emergency Fallback Protocol (If Anyone Gets Stuck)

* **If PostgreSQL deployment is delayed:** Person A provides an Upstash Redis key-value store using the existing `store/index.ts` interface. Feature development never stops.
* **If SMS Gateway approval is delayed:** Person B keeps `console.log(otp)` active in development/staging and provides a temporary bypass code (`1234`) for internal reviewers.
* **If Paystack Live activation is delayed:** Person C keeps Paystack in **Test Sandbox Mode** (`sk_test_...`) with test MoMo prompts so payment UX and webhooks are 100% verified.
