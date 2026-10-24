/**
 * Ghana phone number normalizer, shared by the OTP service (and anything
 * else that needs a canonical recipient format).
 *
 * Accepts: 024xxxxxxx, 0xxxxxxxxx, +233xxxxxxxxx, 233xxxxxxxxx
 * (spaces, dashes and parentheses allowed anywhere).
 * Returns: 233XXXXXXXXX (E.164 without the "+", 12 digits) — the format
 * Arkesel and Upstash keys expect.
 * Throws: a clear Error for anything that isn't a Ghana number.
 */
export function normalizeGhanaPhone(raw: string): string {
  const trimmed = (raw ?? "").trim();
  const compact = trimmed.replace(/[\s\-().]/g, "");

  if (!/^\+?\d+$/.test(compact)) {
    throw new Error(
      `Invalid phone number "${trimmed}": must be digits (you may use 024xxxxxxx, +233xxxxxxxxx or 233xxxxxxxxx).`
    );
  }

  let national: string;
  if (compact.startsWith("+233")) national = compact.slice(4);
  else if (compact.startsWith("233")) national = compact.slice(3);
  else if (compact.startsWith("0")) national = compact.slice(1);
  else {
    throw new Error(
      `Invalid phone number "${trimmed}": expected a Ghana number like 024xxxxxxx, +233xxxxxxxxx or 233xxxxxxxxx.`
    );
  }

  // National significant number: 9 digits (e.g. 241234567 for 024 123 4567).
  if (!/^\d{9}$/.test(national)) {
    throw new Error(
      `Invalid phone number "${trimmed}": Ghana numbers have 10 digits starting with 0 (e.g. 0241234567) or the +233 form.`
    );
  }

  return `233${national}`;
}
