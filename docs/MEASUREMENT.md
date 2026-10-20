# Measurement plan

All dashboard figures in the prototype are **sample data**, used to show how each metric is computed. The targets below are **hypotheses** to test in a pilot, not predictions.

## Core metrics

Definitions use **batches** (one per week under the current assumption). An order is *live* if it isn't cancelled, and *firm* if it's Confirmed or Paid.

| Metric | Formula | Where in the app | Pilot hypothesis (target) |
|---|---|---|---|
| **Repeat-order rate** | customers with live orders in **≥2 different batches** ÷ customers with **≥1** live order, over a window (last 4 batches) | Metrics → card + "Returning customers" column | ≥ 40% of pilot customers order in 2+ of 4 weeks |
| **Confirmed weekly orders** | count of orders with status Confirmed or Paid for a batch (requests excluded) | Metrics → bar chart, Overview → KPI cards | Week-4 confirmed orders ≥ 1.3× week-1, and ≥ 15 orders a week from the pilot group |
| **Cancellation rate** | cancelled orders ÷ all orders created for the batch, split by customer and by business | Metrics → table (c/b split) | ≤ 10% overall. Business-side declines ≤ 5% (a signal of capacity/stock issues) |
| **Forecast accuracy** | `1 − MAPE`, where `MAPE = mean(|actual − forecast| ÷ actual)` over completed batches. *Actual* = firm bottles. *Forecast* = snapshot stored when the batch opens: standing bottles expected + 4-batch moving average of one-off firm bottles | Metrics → forecast vs actual chart + "Abs. % error" | MAPE ≤ 20% by week 4 (that is, ≥ 80% accurate) |

Forecast details:
- Snapshotting the forecast when the batch opens means it can't "peek" at that week's orders.
- Error is measured in **bottles** in the prototype. During the pilot also track **litres** per product, since that drives pressing.
- Report bias (forecast − actual) as well as MAPE, so you can see whether the forecast tends to over- or under-press.

## Supporting metrics

| Metric | Formula | Why |
|---|---|---|
| Request → confirmed rate | firm ÷ (firm + requests that were declined or expired) | Shows whether GoodCane can fulfil what's asked |
| Paid rate | paid ÷ confirmed | Payment friction |
| Standing-order share | firm bottles from standing orders ÷ all firm bottles | Size of the predictable baseline |
| Standing churn | standing orders paused or cancelled ÷ active at start of week | Commitment health |
| Skip rate | skips ÷ standing orders due | Whether "weekly" is the right cadence |
| Reminder opt-in | opted-in ÷ customers | Consent level |
| Reminder → order conversion | reminders opened in WhatsApp that were followed by a live order for that batch ÷ reminders opened | Whether reminders are worth the effort |
| Time to confirm | median hours from request to confirmation | Service level |
| Waste / sell-out (manual) | bottles left unsold; times sold out | The real outcome predictable demand should improve |

## 4-week pilot to validate demand

**Who:** 20–30 customers who opt in, recruited at the **Adenta shop** and the **market stalls** (Parks & Gardens, Green Butterfly). Use a small QR card at the counter ("Pre-order next Saturday's fresh batch") plus the TikTok bio link. Record where each customer was recruited.

**Setup (week 0):**
1. Confirm the assumptions in [WRITEUP.md §3](WRITEUP.md#3-assumptions-to-confirm-with-goodcane) and set them in `config.ts`.
2. Replace sample data with an empty persistent database. Use the real WhatsApp number for click-to-chat (with GoodCane's approval).
3. Agree the reminder text and send window (for example Wednesday 10am, at most one a week). Staff send it manually (level 2).
4. Record a **baseline**: last 4 weeks of bottles pressed, sold, wasted and sold out per product, from GoodCane's own records.

**Weekly loop (weeks 1–4):**
- Monday: the batch opens and the forecast snapshot is stored automatically.
- Mon–Thu: requests come in. GoodCane confirms within 24 hours.
- Wednesday: approve and send reminders to opted-in customers who haven't ordered.
- Thursday 6pm: cutoff. Export CSV and press to firm orders plus a planned buffer.
- Saturday: pickup. Mark paid and note no-shows.
- Sunday: 10-minute review of the scorecard (metrics page + waste/sell-out log).

**Decision rules at the end of week 4:**

| Signal | Continue / scale if… | Rethink if… |
|---|---|---|
| Repeat-order rate | ≥ 40% | < 25%: test a different cadence (fortnightly) or incentives |
| Confirmed weekly orders | growing, or stable ≥ 15 | falling for 2+ weeks |
| Cancellations | ≤ 10% | > 20%: cutoff too early, or pickup is inconvenient |
| Forecast MAPE | ≤ 20% | > 35%: lengthen the window or add a seasonality/market-day factor |
| Waste vs baseline | lower | unchanged or higher |

**Qualitative checks:** 5 short customer calls (Why did you reorder or not? Was the cutoff OK? Was the reminder welcome?) and a debrief with GoodCane staff (time spent confirming, WhatsApp load).

**Ethics & consent:** reminders only with recorded opt-in; STOP honoured the same day; phone numbers visible to GoodCane staff only; delete pilot data on request.
