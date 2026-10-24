---
description: Deep-scans GoodCane documentation against routes, config, types, and domain services, then lists every mismatch. Report only — never auto-fix or change application code.
---

# GoodCane Docs Mismatch Scan

Deep-scan documentation against implementation in the codebase and produce a mismatch report only.

**Hard rule (verbatim):** Do not code or modify any code I just need the report

## Scope

- **In scope:** Read project markdown docs, route handlers under `src/app/api/`, configurations in `src/lib/config.ts`, types in `src/lib/types.ts`, and business rules in `src/lib/services/`. Compare contracts and specifications; list any discrepancies in chat.
- **Out of scope:** Modifying source files, editing tests or configs, modifying markdown docs, fixing mismatches, writing report files to disk.

## Sources

### Source A: Documentation Files
1. `README.md` (Routes table, order lifecycle, assumptions)
2. `docs/WRITEUP.md` (Product catalog, pricing, pickup points, WhatsApp levels, rollout)
3. `docs/MEASUREMENT.md` (KPI definitions, formulas, forecast MAPE calculations)
4. `docs/24_HOUR_SPRINT_PLAN.md` (Sprint architecture, developer boundaries, file ownership)

### Source B: Code Implementation
1. `src/lib/config.ts` (Products, sizes, prices, pickup locations, ASSUMPTIONS)
2. `src/lib/types.ts` (OrderStatus, Order, Customer, StandingOrder, Reminder, ForecastSnapshot)
3. `src/lib/services/` (State machine transitions, validation logic, cutoff checks)
4. `src/app/api/**/route.ts` (Next.js route handlers and parameter bindings)

## Scan Procedure

Compare:
1. **Catalog & Pricing Parity:** Compare product names, sizes, volumes, and prices listed in documentation against `PRODUCTS` in `src/lib/config.ts`.
2. **Pickup & Fulfillment Parity:** Compare pickup point IDs, operating schedules (e.g. 1st & 3rd Saturdays for Parks & Gardens) against `PICKUP_POINTS` in `src/lib/config.ts`.
3. **Endpoint Contracts:** Compare routes listed in `README.md` against actual `route.ts` files under `src/app/api/`.
4. **Order State Lifecycle:** Verify documented states (`requested`, `confirmed`, `paid`, `cancelled`) match `OrderStatus` in `src/lib/types.ts`.
5. **Report:** Output any discrepancies clearly categorized into:
   - High Severity (broken endpoint paths or missing parameters)
   - Medium Severity (pricing, sizing, or naming discrepancies)
   - Low Severity (minor copy, wording, or assumption differences)
