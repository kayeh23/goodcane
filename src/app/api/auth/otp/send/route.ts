import { NextResponse, type NextRequest } from "next/server";
import { body } from "@/lib/api";
import { sendOTP } from "@/lib/auth/otp";
import { normalizeGhanaPhone } from "@/lib/auth/phone";
import { checkOtpSendLimits } from "@/lib/auth/rate-limit";

/**
 * POST { phone } -> sends an OTP by SMS (dev: logs the code to the terminal).
 * Always answers { ok: true } on success — the code itself is NEVER returned.
 * Rate limited: 3/phone/10min and 10/IP/10min (429 + Retry-After).
 */
export async function POST(req: NextRequest) {
  const b = await body(req);
  const phone = typeof b.phone === "string" ? b.phone.trim() : "";
  if (!phone) {
    return NextResponse.json({ error: "Please enter your phone number." }, { status: 400 });
  }

  // Validate + normalize FIRST so the rate-limit key treats "024..." and
  // "+233..." as the same number.
  let normalized: string;
  try {
    normalized = normalizeGhanaPhone(phone);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  // Limit BEFORE generating or sending any code.
  const limit = await checkOtpSendLimits(normalized, ip);
  if (!limit.ok) {
    if (limit.status === 429) {
      return NextResponse.json(
        { error: limit.error },
        {
          status: 429,
          headers: {
            "Retry-After": String(limit.retryAfterSeconds),
            "X-RateLimit-Limit": String(limit.limit),
          },
        }
      );
    }
    return NextResponse.json({ error: limit.error }, { status: limit.status });
  }

  try {
    await sendOTP(normalized);
  } catch (e) {
    const message = (e as Error).message;
    if (message.startsWith("Invalid phone number")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("[otp/send]", e);
    return NextResponse.json(
      { error: "We couldn't send the code right now. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
