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
export function maskPhone(phone: unknown): string {
  let national: string;
  try {
    const n = normalizeGhanaPhone(String(phone ?? ""));
    if (!n) return "*** *** ****";
    national = `0${n.slice(3)}`;
  } catch {
    return "*** *** ****";
  }

  const head = national.slice(0, 3); // e.g. 024
  const tail = national.slice(7); // last 3 digits, e.g. 100
  return `${head} *** *${tail}`;
}
