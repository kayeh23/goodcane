import { randomInt } from "node:crypto";
import { Redis } from "@upstash/redis";
import { normalizeGhanaPhone } from "./phone";

/**
 * Staff/customer OTP service.
 *
 * Storage : Upstash Redis (key `otp:{phone}`, TTL 300s). If the Upstash env
 *          vars are missing outside production, falls back to an in-memory
 *          Map so development is never blocked.
 * Sending : Arkesel SMS API. In development the code is only console.log'd
 *           and NO SMS call is made.
 * Security: max 5 attempts per code, codes are single-use, deleted on
 *           success or on lockout. Never hardcodes secrets — env only.
 */

const OTP_TTL_SECONDS = 300; // 5 minutes
const MAX_ATTEMPTS = 5;
const KEY_PREFIX = "otp:";
const ARKESEL_SEND_URL = "https://sms.arkesel.com/api/v2/sms/send";

type OtpRecord = { code: string; attempts: number };

// ---------------------------------------------------------------------------
// Storage: Upstash Redis, with an in-memory fallback for development.
// ---------------------------------------------------------------------------

const memoryStore = new Map<string, { record: OtpRecord; expiresAt: number }>();

let redisClient: Redis | null = null;
let redisResolved = false;

function getRedis(): Redis | null {
  if (redisResolved) return redisClient;
  redisResolved = true;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    console.warn("[otp] Upstash env vars missing — using in-memory OTP store.");
    return null;
  }
  redisClient = new Redis({ url, token });
  return redisClient;
}

function memoryKey(phone: string) {
  return KEY_PREFIX + phone;
}

async function saveOtp(phone: string, record: OtpRecord, keepTtl = false): Promise<void> {
  const redis = getRedis();
  const key = KEY_PREFIX + phone;
  if (redis) {
    let ex = OTP_TTL_SECONDS;
    if (keepTtl) {
      const ttl = await redis.ttl(key);
      if (ttl > 0) ex = ttl;
    }
    await redis.set(key, JSON.stringify(record), { ex });
    return;
  }
  const existing = memoryStore.get(memoryKey(phone));
  const expiresAt = keepTtl && existing ? existing.expiresAt : Date.now() + OTP_TTL_SECONDS * 1000;
  memoryStore.set(memoryKey(phone), { record, expiresAt });
}

async function readOtp(phone: string): Promise<OtpRecord | null> {
  const redis = getRedis();
  if (redis) {
    const raw = await redis.get<string | OtpRecord>(KEY_PREFIX + phone);
    if (raw == null) return null;
    // The Upstash client auto-deserializes JSON; handle both shapes.
    const record = typeof raw === "string" ? (JSON.parse(raw) as OtpRecord) : raw;
    return record ?? null;
  }

  const entry = memoryStore.get(memoryKey(phone));
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    memoryStore.delete(memoryKey(phone));
    return null;
  }
  return entry.record;
}

async function deleteOtp(phone: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.del(KEY_PREFIX + phone);
    return;
  }
  memoryStore.delete(memoryKey(phone));
}

// ---------------------------------------------------------------------------
// Sending: Arkesel.
// ---------------------------------------------------------------------------

async function sendSms(recipient: string, message: string): Promise<void> {
  const apiKey = process.env.ARKESEL_API_KEY;
  const sender = process.env.SMS_SENDER_ID;
  if (!apiKey || !sender) {
    throw new Error("ARKESEL_API_KEY and SMS_SENDER_ID must be set to send OTP SMS.");
  }

  const res = await fetch(ARKESEL_SEND_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": apiKey },
    body: JSON.stringify({ sender, message, recipients: [recipient] }),
  });

  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    throw new Error(`Failed to send OTP SMS (Arkesel ${res.status}): ${detail}`);
  }
}

// ---------------------------------------------------------------------------
// Public API.
// ---------------------------------------------------------------------------

/**
 * Generates a fresh 4-digit code, stores it for 5 minutes and sends it by SMS.
 * In development the code is console.log'd instead of being texted.
 * Throws on an invalid phone number or an SMS delivery failure.
 */
export async function sendOTP(phone: string): Promise<void> {
  const to = normalizeGhanaPhone(phone);
  const code = String(randomInt(1000, 10000)); // 4 digits, 1000–9999

  await saveOtp(to, { code, attempts: 0 });

  if (process.env.NODE_ENV === "development" || !process.env.ARKESEL_API_KEY) {
    console.log(`[otp] OTP for ${to}: ${code} (SMS skipped: ARKESEL_API_KEY not set)`);
    return;
  }

  await sendSms(to, `Your GoodCane verification code is ${code}. It expires in 5 minutes.`);
}

/**
 * Verifies a code for a phone number.
 * - Max 5 attempts per code; the key is deleted on lockout.
 * - Single-use: deleted on success.
 * - Staging / preview bypass code (e.g. 1234) when OTP_BYPASS_CODE is configured.
 * Returns true if the code is valid, false otherwise.
 * Throws on an invalid phone number.
 */
export async function verifyOTP(phone: string, code: string): Promise<boolean> {
  const to = normalizeGhanaPhone(phone);
  const submitted = (code ?? "").trim();

  const bypass = process.env.OTP_BYPASS_CODE;
  if (bypass && submitted === bypass) {
    return true;
  }

  const record = await readOtp(to);
  if (!record) return false; // never sent, expired, used or locked out

  if (record.attempts >= MAX_ATTEMPTS) {
    await deleteOtp(to);
    return false;
  }

  if (record.code === submitted) {
    await deleteOtp(to); // single-use
    return true;
  }

  record.attempts += 1;
  if (record.attempts >= MAX_ATTEMPTS) {
    await deleteOtp(to); // lockout after the 5th wrong attempt
  } else {
    await saveOtp(to, record, true);
  }
  return false;
}
