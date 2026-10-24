import { compare, hashSync } from "bcryptjs";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { getStaffByUsername } from "../db";
import { sessionOptions, type StaffSession } from "./session";

/** Memoized bcrypt hash of DEV_STAFF_PASSWORD (dev only, see findStaffByUsername). */
let devPasswordHash: string | null = null;

/** Internal staff record — includes the hash, never sent to the client. */
type StaffRecord = {
  username: string;
  role: "admin" | "staff";
  passwordHash: string;
};

/**
 * Staff login lookup. A `staff_users` row wins when Postgres is configured.
 * DEV_STAFF_PASSWORD remains only when that row is missing, and never when
 * VERCEL_ENV=production.
 */
export async function findStaffByUsername(
  username: string
): Promise<StaffRecord | null> {
  const row = await getStaffByUsername(username);
  if (row) {
    const role = row.role === "admin" || row.role === "staff" ? row.role : null;
    if (!role) return null;
    return { username: row.username, role, passwordHash: row.passwordHash };
  }

  if (process.env.VERCEL_ENV === "production") return null;
  if (username !== "admin") return null;

  const devPassword = process.env.DEV_STAFF_PASSWORD;
  if (!devPassword) return null;

  // bcrypt.compare needs a hash, not plaintext — hash the dev password
  // once per process. Replaced entirely at the hour-14 merge.
  devPasswordHash ??= hashSync(devPassword, 10);

  return { username: "admin", role: "admin", passwordHash: devPasswordHash };
}

/**
 * Verifies staff credentials with bcrypt compare.
 * Returns the session payload ({ username, role }) on success, null otherwise.
 * The login route stores the returned payload via getStaffSession().
 */
export async function verifyStaff(
  username: string,
  password: string
): Promise<StaffSession | null> {
  const user = await findStaffByUsername(username);
  if (!user) return null;

  const ok = await compare(password, user.passwordHash);
  if (!ok) return null;

  return { username: user.username, role: user.role };
}

/**
 * Returns the iron-session wrapper for the current request.
 *
 * Note: in Next.js 16 `cookies()` is ASYNC — must be awaited before
 * passing to getIronSession (iron-session v9 accepts the awaited store
 * directly).
 */
export async function getStaffSession() {
  const cookieStore = await cookies();
  return getIronSession<StaffSession>(cookieStore, sessionOptions);
}
