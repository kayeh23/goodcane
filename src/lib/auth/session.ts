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

/**
 * iron-session options for the staff session cookie.
 *
 * This file is imported by middleware, so it must stay free of
 * bcrypt and Node-only imports (next/headers, node:*, etc.).
 *
 * Requires SESSION_SECRET in .env.local (>= 32 chars, e.g. `openssl rand -hex 32`).
 * iron-session derives the cookie's Max-Age from `ttl` (Max-Age = ttl - 60s),
 * so the cookie expires just before the sealed session does.
 */
export const sessionOptions: SessionOptions = {
  cookieName: "goodcane_staff",
  password: process.env.SESSION_SECRET ?? "",
  ttl: TWELVE_HOURS_IN_SECONDS,
  cookieOptions: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  },
};
