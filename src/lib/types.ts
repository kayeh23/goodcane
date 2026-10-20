export type OrderStatus = "requested" | "confirmed" | "paid" | "cancelled";
export type OrderSource = "web" | "reorder" | "standing";

export type LineItem = { productId: string; sizeId: string; qty: number; unitPrice: number };

export type Fulfilment =
  | { type: "pickup"; pointId: string }
  | { type: "delivery"; area: string; landmark?: string };

export type OrderEvent = { at: string; status: OrderStatus | "created"; by: "customer" | "business" | "system"; note?: string };

export type Order = {
  id: string;
  code: string;
  customerId: string;
  batchDate: string; // YYYY-MM-DD (the batch/pickup day)
  items: LineItem[];
  fulfilment: Fulfilment;
  status: OrderStatus;
  source: OrderSource;
  standingOrderId?: string;
  reminderId?: string;
  cancelledBy?: "customer" | "business";
  cancelReason?: string;
  createdAt: string;
  events: OrderEvent[];
  /** Business opened a wa.me confirmation link (manual send). */
  notifiedAt?: string;
  sample: boolean;
};

export type Customer = {
  id: string;
  name: string;
  phone: string; // normalised 10-digit local form, e.g. 0200000001
  remindersOptIn: boolean;
  remindersOptInAt?: string;
  createdAt: string;
  sample: boolean;
};

export type StandingStatus = "active" | "paused" | "cancelled";
export type StandingOrder = {
  id: string;
  customerId: string;
  items: LineItem[];
  fulfilment: Fulfilment;
  status: StandingStatus;
  startBatch: string;
  skipBatches: string[];
  createdAt: string;
  updatedAt: string;
  sample: boolean;
};

/** pending -> approved (by GoodCane) -> opened_whatsapp (business opened wa.me and sends manually); or dismissed */
export type ReminderStatus = "pending" | "approved" | "opened_whatsapp" | "dismissed";
export type Reminder = {
  id: string;
  customerId: string;
  batchDate: string;
  basedOnOrderId: string;
  message: string;
  status: ReminderStatus;
  createdAt: string;
  decidedAt?: string;
  openedAt?: string;
  sample: boolean;
};

export type ForecastSnapshot = {
  batchDate: string;
  standingUnits: number;
  oneOffUnits: number;
  totalUnits: number;
  method: string;
  createdAt: string;
};

export type DB = {
  version: 1;
  seededAt: string;
  customers: Customer[];
  orders: Order[];
  standing: StandingOrder[];
  reminders: Reminder[];
  forecasts: ForecastSnapshot[];
};
