import type { SessionOptions } from "iron-session";

/**
 * Staff session shape.
 * Kept minimal on purpose: middleware only needs to know *whether*
 * someone is logged in, never what they submitted.
 */
export type StaffSession = {
  username?: string;
  role?: "admin" | "staff";
};

const TWELVE_HOURS_IN_SECONDS = 12 * 60 * 60;
const DEV_SESSION_SECRET = "dev-only-goodcane-session-secret-32b";

/**
 * Production requires SESSION_SECRET (>= 32 chars). Development uses a
 * fixed local secret so a value checked into .env.example is never the key.
 */
function sessionPassword() {
  const fromEnv = process.env.SESSION_SECRET ?? "";
  if (fromEnv.length >= 32) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be at least 32 characters.");
  }
  return DEV_SESSION_SECRET;
}

/**
 * iron-session options for the staff session cookie.
 *
 * This file is imported by proxy.ts, so it must stay free of
 * bcrypt and Node-only imports (next/headers, node:*, etc.).
 *
 * iron-session derives the cookie's Max-Age from `ttl` (Max-Age = ttl - 60s),
 * so the cookie expires just before the sealed session does.
 */
export const sessionOptions: SessionOptions = {
  cookieName: "goodcane_staff",
  password: sessionPassword(),
  ttl: TWELVE_HOURS_IN_SECONDS,
  cookieOptions: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  },
};
