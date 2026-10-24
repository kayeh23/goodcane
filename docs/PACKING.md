# Kitchen Pack Sheet Guide (Phase 5)

This document outlines the architecture, data flow, API endpoints, and kitchen operational workflow for the GoodCane Kitchen Pack Sheet view located at `/business/packing`.

---

## 1. Overview and Purpose

During Saturday batch production, kitchen staff need to fulfill pre-orders efficiently. The Kitchen Pack Sheet groups confirmed and paid orders into four distinct fulfillment locations:

1. **Adenta Shop Table**: Pickups scheduled at Aviation Road, Adenta.
2. **Parks & Gardens Table**: Pickups scheduled at the Parks & Gardens market (1st & 3rd Saturdays).
3. **Green Butterfly Table**: Pickups scheduled at the Green Butterfly Market in Cantonments.
4. **Delivery Dispatch Table**: Door-to-door deliveries across Accra dispatch routes.

Each order progresses through a three-stage preparation pipeline:
`[ ] Bottled` -> `[ ] Packed` -> `[ ] Collected`

---

## 2. Fulfillment Pipeline Stages

Kitchen staff track each order using individual progression toggles:

| Stage | Description | Meaning for Kitchen Staff |
| :--- | :--- | :--- |
| `pending` | Initial state for confirmed or paid orders | Juices are not yet pressed or bottled |
| `bottled` | First stage completed | Required recipes have been pressed into sterile bottles |
| `packed` | Second stage completed | Bottles are boxed or bagged together with order receipt label |
| `collected` | Final stage completed | Customer picked up order or delivery driver departed with parcel |

---

## 3. API Endpoints

### 3.1 Fetch Packing Data
- **Route:** `GET /api/admin/packing`
- **Authentication:** Required (`goodcane_staff` iron-session)
- **Query Parameters:**
  - `batch` (optional, string `YYYY-MM-DD`): Target batch date. Defaults to `nextBatch()`.

#### Response Schema:
```json
{
  "batch": "2026-10-31",
  "nextBatch": "2026-10-31",
  "batches": ["2026-10-31", "2026-10-24"],
  "tables": [
    {
      "id": "adenta",
      "title": "Adenta Shop Table",
      "subtitle": "Aviation Road, Adenta · hours to confirm",
      "type": "pickup",
      "pointId": "adenta",
      "stats": {
        "ordersCount": 12,
        "bottlesCount": 28,
        "bottledCount": 18,
        "packedCount": 10,
        "collectedCount": 4
      },
      "skuSummary": [
        {
          "productId": "raw",
          "sizeId": "330ml",
          "productName": "Raw Sugarcane",
          "sizeLabel": "330ml",
          "color": "#B9D84A",
          "qty": 14
        }
      ],
      "orders": [...]
    }
  ],
  "summary": {
    "totalOrders": 35,
    "totalBottles": 84,
    "bottledBottles": 50,
    "packedBottles": 32,
    "collectedBottles": 12
  }
}
```

---

### 3.2 Update Packing Stage
- **Route:** `POST /api/admin/orders/:id`
- **Authentication:** Required (`goodcane_staff` iron-session)
- **Request Body:**
```json
{
  "action": "pack_stage",
  "reason": "bottled" // "pending" | "bottled" | "packed" | "collected"
}
```
- **Response:**
```json
{
  "id": "o_abc123",
  "status": "paid"
}
```

Each stage transition is immutably appended to the order's `events` array with note `packing:<stage>`.

---

## 4. Reusable UI Components

The packing interface uses modular components located in `src/components/`:
- **`PackingStageToggle`** (`src/components/packing-stage-toggle.tsx`): Checkbox toggle supporting reversible stage progression with accessible ARIA labels.
- **`PackingTable`** (`src/components/packing-table.tsx`): Location card with SKU batch prep summaries, stage progress bars, and responsive order tables.
