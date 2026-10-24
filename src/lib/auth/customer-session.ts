import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

/**
 * Customer session: created only after a phone number has been verified
 * via OTP. Separate from the staff session (cookie `goodcane_staff`).
 *
 * Requires SESSION_SECRET (same secret as the staff session).
 */
export type CustomerSession = {
  /** The OTP-verified phone in 233XXXXXXXXX format. */
  phone?: string;
};

const TWO_HOURS_IN_SECONDS = 2 * 60 * 60;

export const customerSessionOptions: SessionOptions = {
  cookieName: "goodcane_customer",
  password: process.env.SESSION_SECRET ?? "",
  ttl: TWO_HOURS_IN_SECONDS,
  cookieOptions: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  },
};

async function openCustomerSession() {
  const cookieStore = await cookies();
  return getIronSession<CustomerSession>(cookieStore, customerSessionOptions);
}

/**
 * Returns the OTP-VERIFIED phone number (233XXXXXXXXX) for the current
 * request, or null when the customer has no valid session.
 * Use this from /my-orders pages and its API routes.
 */
export async function getCustomerSession(): Promise<string | null> {
  const session = await openCustomerSession();
  return session.phone ?? null;
}

/** Stores the verified phone in the customer session (2-hour cookie). */
export async function setCustomerPhone(phone: string): Promise<void> {
  const session = await openCustomerSession();
  session.phone = phone;
  await session.save();
}

/** Destroys the customer session (e.g. on sign-out). */
export async function clearCustomerSession(): Promise<void> {
  const session = await openCustomerSession();
  session.destroy();
}
