import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Rate limiting for OTP code requests.
 *
 * - 3 requests per phone number per 10 minutes (sliding window).
 * - 10 requests per IP per 10 minutes (sliding window, looser).
 * - Redis keys use the `rl:otp:` prefix so they never clash with the
 *   `otp:` code keys (see src/lib/auth/otp.ts).
 * - Missing Upstash env vars: skipped (with a one-time console.warn)
 *   outside production; in production we FAIL CLOSED instead of
 *   allowing unlimited sends.
 *
 * Identifiers MUST be pre-normalized by the caller: phones via
 * normalizeGhanaPhone() so "024..." and "+233..." share one bucket.
 */

const WINDOW = "10 m"; // 10 minutes (Duration format: `${number} ${Unit}`)
const PHONE_LIMIT = 3;
const IP_LIMIT = 10;
const KEY_PREFIX = "rl:otp:";

export type RateLimitResult =
  | { ok: true }
  | {
      ok: false;
      status: number;
      error: string;
      /** Seconds the caller should wait, for the Retry-After header. */
      retryAfterSeconds: number;
      limit: number;
    };

let phoneLimiter: Ratelimit | null = null;
let ipLimiter: Ratelimit | null = null;
let warnedOnce = false;

type Setup = "ready" | "skip" | "fail";
let setupResult: Setup | null = null;

function setup(): Setup {
  if (setupResult) return setupResult;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    if (!warnedOnce) {
      console.warn(
        "[otp/ratelimit] Upstash env vars missing — OTP rate limiting is DISABLED."
      );
      warnedOnce = true;
    }
    setupResult = "skip";
    return setupResult;
  }

  const redis = new Redis({ url, token });
  phoneLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(PHONE_LIMIT, WINDOW),
    prefix: KEY_PREFIX,
  });
  ipLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(IP_LIMIT, WINDOW),
    prefix: KEY_PREFIX,
  });
  setupResult = "ready";
  return setupResult;
}

function blocked(reset: number, limit: number, error: string): RateLimitResult {
  const retryAfterSeconds = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
  return { ok: false, status: 429, error, retryAfterSeconds, limit };
}

/**
 * Checks both limits for one OTP send request, in order:
 * phone first, then IP. Returns { ok: true } when the request may proceed.
 *
 * Messages are generic on purpose — they must never reveal whether a
 * number is registered or exists.
 */
export async function checkOtpSendLimits(
  phone: string,
  ip: string
): Promise<RateLimitResult> {
  const mode = setup();

  if (mode === "fail") {
    return {
      ok: false,
      status: 503,
      error: "Code requests are temporarily unavailable. Please try again later.",
      retryAfterSeconds: 0,
      limit: 0,
    };
  }
  if (mode === "skip") return { ok: true };

  const phoneCheck = await phoneLimiter!.limit(`phone:${phone}`);
  if (!phoneCheck.success) {
    return blocked(
      phoneCheck.reset,
      phoneCheck.limit,
      "Too many code requests for this number. Please wait a few minutes before trying again."
    );
  }

  const ipCheck = await ipLimiter!.limit(`ip:${ip}`);
  if (!ipCheck.success) {
    return blocked(
      ipCheck.reset,
      ipCheck.limit,
      "Too many code requests from this device. Please wait a few minutes before trying again."
    );
  }

  return { ok: true };
}
