# GoodCane — from discovery to a weekly ordering habit

*Prototype write-up. All customer and order data in the demo is labelled sample data. Anything about GoodCane's operations below is either taken from their public TikTok and marked "to confirm", or is an explicit assumption.*

## 1. The customer problem

GoodCane makes fresh, pressed sugarcane juices and a made-to-order Tigernut-Coconut drink. People discover it on TikTok, at markets, and at the shop. Interest alone doesn't add up to a steady ordering routine:

- **For customers**, ordering again takes effort. You have to remember, find the number, message or call, ask what's available, and agree on pickup. There's no "my usual" and no nudge before the batch.
- **For GoodCane**, demand only becomes visible when messages arrive. A fresh product with a short shelf life (to confirm) is either pressed blind, which risks waste, or pressed short, which risks selling out. WhatsApp chats don't separate *"I might want some"* from *"confirmed and paid"*, so you can't add them up into a production number.

**Job to be done:** *"When I've enjoyed GoodCane, help me get my usual bottles every week with almost no effort, and let GoodCane know exactly how much to press."*

## 2. Evidence from GoodCane's TikTok (@goodcane.co) — to confirm

| Observation | Implication for the design |
|---|---|
| Wordmark: stacked "GOOD / CANE" in chunky rounded caps, black/white with sugarcane green and cream; each flavour has its own label colour | Brand look reused: flavour colour dots, cream background, stacked wordmark |
| Products: Raw Sugarcane, Lemon & Ginger, Mint & Lemon, Passion Fruit (330ml); Tigernut-Coconut in 330ml / 500ml / 2L / 4L | Product catalogue in `config.ts` |
| Posted prices: GH₵35 (330ml); Tigernut-Coconut GH₵45 (500ml), GH₵180 (2L), GH₵260 (4L) | Shown as "Price per GoodCane TikTok — to confirm" |
| Tigernut-Coconut is **pre-order / made to order** | Pre-ordering is already familiar to the brand and its customers |
| Customers **call or WhatsApp** to order | Keep WhatsApp in the loop: click-to-chat, not a new channel to learn |
| Shop on **Aviation Road, Adenta**; stalls at **Parks & Gardens** and **Green Butterfly Market** | Pickup points. Parks & Gardens is modelled as 1st & 3rd Saturdays (to confirm) |
| Tagline **"Good Juice. Beautiful People."** with a warm community tone | Copy tone: friendly and community-first |
| No delivery areas or fees stated | Delivery is a placeholder. Pickup is the default |

## 3. Assumptions to confirm with GoodCane

These must be checked before a pilot. Each one maps to a single value in `src/lib/config.ts` or to a process.

- [ ] **Batch rhythm**: one main batch a week, on Saturday? Or several batches (for example Wed + Sat)?
- [ ] **Cutoff**: Thursday 6pm is enough lead time for sourcing cane and tigernut?
- [ ] **Shelf life** of each drink (sets how far ahead people can order and whether one weekly batch is enough)
- [ ] **Capacity** per batch, and per product (do we need a "batch full" limit?)
- [ ] **Prices** per size (TikTok prices still current? Any bundle or standing-order price?)
- [ ] **Tigernut-Coconut sizes** and lead time (is 2L/4L same-week?)
- [ ] **Pickup points**: Adenta shop hours; Parks & Gardens dates (1st & 3rd Saturday?); Green Butterfly Market days and times
- [ ] **Delivery**: offered at all? Which areas, fees, rider partner, minimum order?
- [ ] **Payment**: MoMo, cash on pickup, or deposit for large/tigernut orders? When is an order considered "paid"?
- [ ] **Who confirms orders** and how quickly (same day?). What happens to unconfirmed requests at cutoff?
- [ ] **Cancellation policy** after confirmation, and after payment
- [ ] **WhatsApp number** to use for click-to-chat, and who on the team handles it
- [ ] **Reminder wording, timing and frequency** (for example Wednesday morning, at most one a week), and consent wording
- [ ] **Data handling**: who can see customer phone numbers; how long they're kept (Ghana Data Protection Act, 2012 (Act 843))
- [ ] **Bottle returns/deposits**, if any (affects reorder flow)

## 4. Chosen approach and why

**Weekly batch pre-orders + opt-in repeat reminders + recurring weekly standing-order requests**, with WhatsApp kept as the conversation channel.

| Option | Repeat habit | Demand visibility | Fit for GoodCane now | Verdict |
|---|---|---|---|---|
| **Weekly batch pre-orders** | Medium (a clear weekly ritual) | **High**: exact quantities before pressing | Fresh batches; tigernut already pre-order | **Core** |
| Repeat-order reminders | **High** for lapsed buyers | Low on its own | Cheap; WhatsApp-native | **Layered on** (opt-in, approved) |
| Standing orders (recurring requests) | **Highest** for loyal fans | **High**: a known baseline every week | Needs a loyal base, which markets and the shop provide | **Layered on** (confirmed weekly, skip/pause) |
| Group/office orders | Medium | Medium | More build and coordination | Later |
| WhatsApp-first ordering bot | Medium | Medium | Needs Business Platform approval and cost | Later (see rollout level 3) |
| Event/bulk pre-orders | Low frequency | Lumpy | Good revenue but not routine | Later |

Why this combination works:
- **The batch gives a reason to order now.** "Order by Thursday 6pm for Saturday's fresh batch" creates a deadline and a weekly rhythm.
- **Requests ≠ orders.** Every order starts as a *Request*, becomes *Confirmed* when GoodCane accepts it, and becomes *Paid* when GoodCane marks it paid. The dashboard adds up each status separately, so GoodCane presses for firm demand and sees the upside separately.
- **Standing orders give a baseline.** Each week the standing order creates that batch's Request, which GoodCane still confirms. Customers can skip a week, pause or cancel at any time, so it's low commitment.
- **Reminders bring back lapsed buyers without spam.** They're opt-in, drafted only for people who ordered in the last two batches and haven't ordered this week, and nothing goes out until GoodCane approves it and sends it from WhatsApp.
- **Minimal data.** Name (for the bottle label) and phone (to confirm and find orders). No accounts, no payment details.
- **No AI needed** for the core. A transparent moving-average forecast is easier for a small team to trust and check. AI could later help parse free-text WhatsApp orders into structured requests.

## 5. How the prototype works (summary)

Customer: open the link → see the next batch and cutoff → choose drinks → pickup or delivery → name + phone, with optional reminders and weekly repeat → **Request** saved → optional "Send to GoodCane on WhatsApp" → later, **My orders** by phone → one-tap **Reorder**, skip, pause or cancel, reminders off.

Business: Batch desk → next-batch demand split Requested/Confirmed/Paid → confirm, decline or mark paid → optional "Notify on WhatsApp" → reminder queue (approve → open in WhatsApp → send manually) → 4-batch outlook → metrics → CSV for the production sheet.

## 6. Rollout plan

### Phase 0 — Confirm (week 0)
Review the assumptions checklist with GoodCane. Set the batch day, cutoff, prices, pickup points and WhatsApp number in `config.ts`. Agree reminder wording and consent text. Switch storage to a persistent database. Replace the demo passcode with staff logins and add SMS one-time codes for "My orders".

### Phase 1 — Pilot (weeks 1–4)
20–30 opted-in customers recruited at the Adenta shop and market stalls (QR card + TikTok bio link). The design is in [MEASUREMENT.md](MEASUREMENT.md). GoodCane confirms orders daily and exports the CSV for each batch.

### Phase 2 — Open to all (weeks 5–12)
If the pilot meets its thresholds: put the link in the TikTok bio, pin a video showing "how to pre-order", and add batch-full limits. Possibly a second weekly batch if demand exceeds capacity.

### Phase 3 — Scale
Payment links (MoMo) only after GoodCane chooses a provider and approves it. Group/office orders. Event packs.

### WhatsApp integration — three levels

| Level | What | When | Requirements |
|---|---|---|---|
| **1. Click-to-chat (built)** | Customer taps **"Send to GoodCane on WhatsApp"**. A `wa.me` link opens their WhatsApp with the order ref, items, batch date, pickup point and name filled in, and they press Send. | **Pilot** | GoodCane's number (currently a **placeholder `233000000000`** in config, to replace once approved). No API, no cost. |
| **2. Manual one-tap messages from the dashboard (built)** | In the reminder queue, GoodCane **approves** a reminder. Only then does **"Open in WhatsApp"** unlock, opening `wa.me/<customer>` with the reminder text (with the reorder link and "Reply STOP to opt out"). The status becomes *Opened in WhatsApp (business sends manually)*. "Notify on WhatsApp" works the same way for confirmations. | **Pilot** | Customer opted in (recorded at checkout). Staff send from GoodCane's phone. No API, no cost. |
| **3. WhatsApp Business Platform (Cloud API) automated templates** | Approved reminders and confirmations are sent automatically as template messages. STOP replies are handled by webhook. | **Post-pilot, only if levels 1–2 prove value** | Meta business verification; **pre-approved message templates**; **recorded opt-in** for each customer; **per-message cost** (marketing and utility conversations are charged); a hosting/BSP account; and **GoodCane's explicit approval** before anything is sent. |

Nothing in this prototype sends a message or takes a payment by itself.

## 7. Risks and mitigations

- *Customers don't confirm or collect.* Requests are not firm until GoodCane confirms them. The pilot tracks no-shows, and deposits for big tigernut sizes are an option.
- *Reminder fatigue.* Opt-in only, at most one a week, approval gate, STOP and a toggle in My orders.
- *Market days vary.* Pickup availability rules per point (for example 1st and 3rd Saturdays) live in config.
- *Phone lookup privacy.* Add a one-time code before the pilot. Only the fields that are needed are shown.
