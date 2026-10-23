---
description: Smoke-tests GoodCane HTTP API endpoints and returns a pass/fail/skip report only. Use when explicitly asked for an API endpoint report, endpoint smoke test, or api-endpoint-report workflow. Never auto-fix or change application code.
---

# GoodCane API Endpoint Report

Smoke-test all Next.js API endpoints in this project and produce a report.

**Hard rule (verbatim):** do not edit or modify or fix this code just give me report

## Scope

- **In scope:** Discover Next.js route handlers under `src/app/api/`, send HTTP smoke requests, classify results, and report in chat.
- **Out of scope:** Editing source code, modifying database records, altering configs or docs, fixing failures, writing report files to disk.

## Prerequisites

1. Ensure the application dev server is running or start it temporarily (e.g., `npm run dev` or `PORT=3000 npm start`).
2. Target base URL defaults to `http://localhost:3000`.
3. Admin endpoints require the admin session/passcode cookie (set via `POST /api/admin/login` with `{ "passcode": DEMO_PASSCODE }`).

## Endpoint Inventory

### 1. Customer & Public Routes (`src/app/api/`)

| Method | Path | Expected Payload / Notes | Auth |
|---|---|---|---|
| GET | `/api/batch` | None. Returns batchDate, cutoff, pickup points | None |
| POST | `/api/orders` | `{ name, phone, items, fulfilment, remindersOptIn, repeatWeekly }` | None |
| GET | `/api/orders/[id]` | Query order status by ID | None |
| POST | `/api/orders/[id]/reorder` | `{ phone }` | None |
| POST | `/api/orders/[id]/cancel` | `{ phone }` | None |
| POST | `/api/lookup` | `{ phone }` | None |
| POST | `/api/standing/[id]` | `{ phone, action: "skip" | "pause" | "resume" | "cancel" }` | None |
| POST | `/api/reminders/preferences`| `{ phone, optIn: boolean }` | None |

### 2. Admin & Batch Desk Routes (`src/app/api/admin/`)

| Method | Path | Expected Payload / Notes | Auth |
|---|---|---|---|
| POST | `/api/admin/login` | `{ passcode: string }` | Passcode / Cookie |
| POST | `/api/admin/logout` | Clears admin session cookie | Cookie |
| GET | `/api/admin/overview` | Returns next-batch demand counts, litres, outlook | Cookie |
| GET | `/api/admin/orders` | Query params: `?status=all&source=all&batch=...` | Cookie |
| POST | `/api/admin/orders/[id]` | `{ action: "confirm" | "pay" | "cancel" | "notified", reason?: string }` | Cookie |
| GET | `/api/admin/reminders` | List pending and approved reminders | Cookie |
| POST | `/api/admin/reminders/[id]` | `{ action: "approve" | "dismiss" | "open" }` | Cookie |
| GET | `/api/admin/metrics` | Scorecard metrics, MAPE forecast error, weekly table | Cookie |
| GET | `/api/admin/export` | CSV export for kitchen pack sheet | Cookie |
| POST | `/api/admin/reset` | Resets in-memory DB to seed data (demo only) | Cookie |

## Smoke Procedure

For each endpoint:
1. Probe with `curl` or Node `fetch` against the running server.
2. Evaluate response status code:
   - **PASS**: 200/201 response with valid JSON, or 400/404/409 validation response confirming the endpoint handles input correctly.
   - **FAIL**: 500 internal server error or unhandled exception.
   - **SKIP**: Route requires live external provider (e.g. real SMS dispatch or live MoMo gateway) not configured in the test environment.
3. Output the concise tabular summary in chat.
