/**
 * GoodCane prototype configuration.
 *
 * EVERYTHING in this file is either taken from GoodCane's public TikTok
 * (@goodcane.co) and marked "to confirm", or is an ASSUMPTION made for the
 * prototype. Change values here; the rest of the app reads from this file.
 */

export const ASSUMPTIONS = {
  /** Ghana time is UTC+0 with no daylight saving, so dates are handled in UTC. */
  timezone: "Africa/Accra (UTC+0)",
  /** ASSUMPTION: one fresh batch per week, pressed for Saturday. 0=Sun … 6=Sat */
  batchWeekday: 6,
  /** ASSUMPTION: pre-order cutoff is Thursday 6pm before the batch. */
  cutoffDaysBefore: 2,
  cutoffHour: 18,
  /** ASSUMPTION: max bottles per line item in a single order (guards typos). */
  maxQtyPerLine: 20,
  /** Forecast: simple moving average over this many recent completed batches. */
  forecastWindowWeeks: 4,
  /** How many future batches the dashboard shows. */
  outlookWeeks: 4,
  /** Reminders are drafted for opted-in customers whose last order was within N batches. */
  reminderLookbackWeeks: 2,
} as const;

export const BRAND = {
  name: "GoodCane",
  tagline: "Good Juice. Beautiful People.",
  tiktok: "https://www.tiktok.com/@goodcane.co",
  tiktokHandle: "@goodcane.co",
};

export const PRICE_NOTE = "Price per GoodCane TikTok — to confirm";

export type Size = { id: string; label: string; ml: number; price: number };
export type Product = {
  id: string;
  name: string;
  short: string;
  color: string;
  ink: string;
  image: string;
  description: string;
  madeToOrder: boolean;
  sizes: Size[];
};

const S330: Size = { id: "330ml", label: "330ml", ml: 330, price: 35 };

export const PRODUCTS: Product[] = [
  {
    id: "raw",
    name: "Raw Sugarcane",
    short: "Raw",
    color: "#B9D84A",
    ink: "#4E6B12",
    image: "/products/raw.jpg",
    description: "Pure pressed sugarcane.",
    madeToOrder: false,
    sizes: [S330],
  },
  {
    id: "lemon-ginger",
    name: "Lemon & Ginger Sugarcane",
    short: "Lemon & Ginger",
    color: "#C8643B",
    ink: "#8A3A1A",
    image: "/products/lemon_ginger.jpg",
    description: "Sugarcane with a lemon & ginger kick.",
    madeToOrder: false,
    sizes: [S330],
  },
  {
    id: "mint-lemon",
    name: "Mint & Lemon Sugarcane",
    short: "Mint & Lemon",
    color: "#13836F",
    ink: "#0B5B4C",
    image: "/products/mint_lemon.jpg",
    description: "Cool mint and lemon.",
    madeToOrder: false,
    sizes: [S330],
  },
  {
    id: "passion",
    name: "Passion Fruit Sugarcane",
    short: "Passion Fruit",
    color: "#4B2A91",
    ink: "#3A1F73",
    image: "/products/passion.jpg",
    description: "Sugarcane with passion fruit.",
    madeToOrder: false,
    sizes: [S330],
  },
  {
    id: "tigernut",
    name: "Tigernut-Coconut",
    short: "Tigernut-Coconut",
    color: "#C49A6C",
    ink: "#7A5631",
    image: "/products/tigernut.jpg",
    description: "Creamy tigernut & coconut. Made to order (pre-order only).",
    madeToOrder: true,
    sizes: [
      S330,
      { id: "500ml", label: "500ml", ml: 500, price: 45 },
      { id: "2L", label: "2L", ml: 2000, price: 180 },
      { id: "4L", label: "4L", ml: 4000, price: 260 },
    ],
  },
];

export type PickupPoint = {
  id: string;
  name: string;
  detail: string;
  /** Optional availability rule for a given batch date (YYYY-MM-DD). */
  availableOn?: (batchDate: string) => boolean;
  availabilityNote?: string;
};

/** Nth Saturday of the month for a YYYY-MM-DD date. */
function nthWeekdayOfMonth(date: string) {
  const d = Number(date.slice(8, 10));
  return Math.ceil(d / 7);
}

export const PICKUP_POINTS: PickupPoint[] = [
  {
    id: "adenta",
    name: "Adenta shop",
    detail: "Aviation Road, Adenta · hours to confirm",
  },
  {
    id: "parks-gardens",
    name: "Parks & Gardens market",
    detail: "1st & 3rd Saturdays · to confirm",
    availableOn: (batchDate) => [1, 3].includes(nthWeekdayOfMonth(batchDate)),
    availabilityNote: "Only on 1st & 3rd Saturdays",
  },
  {
    id: "green-butterfly",
    name: "Green Butterfly Market",
    detail: "Cantonments · market days to confirm",
  },
];

/** Delivery is a placeholder: GoodCane's TikTok does not state delivery areas or fees. */
export const DELIVERY_AREAS = [
  "Delivery area A (sample, to confirm)",
  "Delivery area B (sample, to confirm)",
  "Delivery area C (sample, to confirm)",
];
export const DELIVERY_NOTE =
  "Delivery areas and fees are placeholders — to confirm with GoodCane. No fee is charged in this prototype.";

export const DEMO_PASSCODE = process.env.DEMO_PASSCODE || "goodcane-demo";

export function getProduct(id: string) {
  return PRODUCTS.find((p) => p.id === id);
}
export function getSize(productId: string, sizeId: string) {
  return getProduct(productId)?.sizes.find((s) => s.id === sizeId);
}
export function getPickup(id: string) {
  return PICKUP_POINTS.find((p) => p.id === id);
}
export function pickupAvailable(id: string, batchDate: string) {
  const p = getPickup(id);
  if (!p) return false;
  return p.availableOn ? p.availableOn(batchDate) : true;
}

/**
 * WhatsApp "click-to-chat" (wa.me) — NO API, nothing is ever sent automatically.
 * PLACEHOLDER number: replace with GoodCane's number once approved by GoodCane.
 * (Format: country code + number, digits only, e.g. 233XXXXXXXXX.)
 */
export const GOODCANE_WHATSAPP = process.env.NEXT_PUBLIC_GOODCANE_WHATSAPP || "233000000000";
export const WHATSAPP_IS_PLACEHOLDER = GOODCANE_WHATSAPP === "233000000000";
