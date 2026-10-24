// Focused live checks for the Task 3 customer-auth requirements.
// Run only after the dev server is up on BASE_URL (default http://localhost:3000).
// Prints PASS/FAIL lines; exits non-zero on first failure.

import fs from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const devLogPath = ".next/dev/logs/next-development.log";

const ok = async (name, cond) => {
  if (!cond) throw new Error("FAILED: " + name);
  console.log("PASS:", name);
};

const postJson = async (path, body, opts = {}) => {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...opts.headers },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, setCookie: res.headers.get("set-cookie") || "" };
};

const getJson = async (path, opts = {}) => {
  const res = await fetch(BASE + path, { headers: opts.headers });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
};

const waitForDevCode = async (e164Phone) => {
  const needle = `DEV OTP for ${e164Phone}:`;
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (fs.existsSync(devLogPath)) {
      const txt = fs.readFileSync(devLogPath, "utf8");
      const line = txt.split("\n").slice(-50).find((l) => l.includes(needle));
      if (line) {
        const m = line.match(/DEV OTP for \d+: (\d{4})/);
        if (m) return m[1];
      }
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return null;
};

// 1. lookup without a session -> 401, ignores body.phone
const noSessionLookup = await postJson("/api/lookup", { phone: "0241234567" });
await ok("lookup without session returns 401", noSessionLookup.status === 401);
await ok("lookup without session error mentions sign in", String(noSessionLookup.data?.error).includes("sign in"));

// 2. send OTP -> verify -> lookup with session -> 200, returns verified phone
const TEST_PHONE_LOCAL = "0249999999";
const sendRes = await postJson("/api/auth/otp/send", { phone: TEST_PHONE_LOCAL });
await ok("send OTP succeeds", sendRes.status === 200 && sendRes.data?.ok === true);
const otpCode = await waitForDevCode("2339999999");
await ok("dev OTP code found in dev log", otpCode);
const verifyRes = await postJson("/api/auth/otp/verify", { phone: TEST_PHONE_LOCAL, code: otpCode });
await ok("verify OTP succeeds", verifyRes.status === 200 && verifyRes.data?.ok === true);
await ok("verify sets customer cookie", verifyRes.setCookie.length > 0);
const cookieHeader = verifyRes.setCookie.split(";")[0];

const sessionLookup = await getJson("/api/lookup", { headers: { cookie: cookieHeader } });
await ok("lookup with verified session returns 200", sessionLookup.status === 200);
await ok("lookup returns the verified phone, not a body-supplied one", sessionLookup.data?.customer?.phone === TEST_PHONE_LOCAL);

// 3. one customer cannot read or cancel another customer's order
const OTHER_PHONE_LOCAL = "0248888888";
const otherSendRes = await postJson("/api/auth/otp/send", { phone: OTHER_PHONE_LOCAL });
await ok("send OTP for second phone succeeds", otherSendRes.status === 200 && otherSendRes.data?.ok === true);
const otherCode = await waitForDevCode("2338888888");
await ok("second dev OTP code found", otherCode);
const otherVerifyRes = await postJson("/api/auth/otp/verify", { phone: OTHER_PHONE_LOCAL, code: otherCode });
await ok("second verify sets cookie", otherVerifyRes.status === 200 && otherVerifyRes.setCookie.length > 0);
const otherCookie = otherVerifyRes.setCookie.split(";")[0];

const aliceOrderId = sessionLookup.data?.orders?.[0]?.id;
await ok("alice has at least one order to test ownership against", Boolean(aliceOrderId));

const aliceReadsBobOrder = await getJson(`/api/orders/${aliceOrderId}`, { headers: { cookie: cookieHeader } });
await ok("alice cannot read bob's order detail (401/404)", aliceReadsBobOrder.status === 401 || aliceReadsBobOrder.status === 404);

const bobCancelAlice = await postJson(`/api/orders/${aliceOrderId}/cancel`, { phone: TEST_PHONE_LOCAL }, { headers: { cookie: otherCookie } });
await ok("bob cannot cancel alice's order", bobCancelAlice.status !== 200);

console.log("\nAll Task 3 customer-auth checks passed.");
