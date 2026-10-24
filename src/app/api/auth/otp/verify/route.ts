import { NextResponse, type NextRequest } from "next/server";
import { body } from "@/lib/api";
import { verifyOTP } from "@/lib/auth/otp";
import { setCustomerPhone } from "@/lib/auth/customer-session";
import { normalizeGhanaPhone } from "@/lib/auth/phone";

/**
 * POST { phone, code } -> verifies the OTP and, on success, creates the
 * short-lived customer session cookie (`goodcane_customer`, 2 hours)
 * storing the verified phone.
 */
export async function POST(req: NextRequest) {
  const b = await body(req);
  const phone = typeof b.phone === "string" ? b.phone.trim() : "";
  const code = typeof b.code === "string" ? b.code.trim() : "";

  if (!phone || !code) {
    return NextResponse.json(
      { error: "Phone number and code are both required." },
      { status: 400 }
    );
  }

  let normalized: string;
  try {
    normalized = normalizeGhanaPhone(phone);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  let valid = false;
  try {
    valid = await verifyOTP(normalized, code);
  } catch (e) {
    console.error("[otp/verify]", e);
    valid = false;
  }

  if (!valid) {
    return NextResponse.json(
      { error: "That code is incorrect or has expired. Please try again." },
      { status: 401 }
    );
  }

  await setCustomerPhone(normalized);
  return NextResponse.json({ ok: true });
}
