import { normalizeGhanaPhone } from "./phone";

/**
 * Masks a Ghana phone number for display: keeps the network prefix and
 * the last three digits, hides the rest.
 *
 *   0241234100 / 233241234100 / +233241234100 / "024 123 4100"
 *     -> "024 *** *100"
 *
 * Reuses normalizeGhanaPhone(), so every accepted input format maps to the
 * same masked string. NEVER throws: invalid or missing input returns a
 * generic masked string instead.
 */
export function maskPhone(phone: string): string {
  let national: string;
  try {
    const e164 = normalizeGhanaPhone(phone); // 233XXXXXXXXX
    national = `0${e164.slice(3)}`; // 0XXXXXXXXX (10 digits)
  } catch {
    return "*** *** ****"; // generic mask — never leak why it failed
  }

  const head = national.slice(0, 3); // e.g. 024
  const tail = national.slice(7); // last 3 digits, e.g. 100
  return `${head} *** *${tail}`;
}
