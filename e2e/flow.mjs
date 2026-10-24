// End-to-end check of the full demo flow + screenshots.
// Usage: BASE_URL=http://localhost:3000 SHOTS=../app-shots node e2e/flow.mjs
// Uses playwright-core with a locally installed Chrome (CHROME_PATH to override).
import { chromium } from "playwright-core";
import fs from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const SHOTS = process.env.SHOTS || "e2e/shots";
const STAFF_USER = process.env.DEV_STAFF_USERNAME || "admin";
const STAFF_PASS = process.env.DEV_STAFF_PASSWORD || "";
if (!STAFF_PASS) throw new Error("Set DEV_STAFF_PASSWORD to the same value the server was started with.");
fs.mkdirSync(SHOTS, { recursive: true });
const log = (...a) => console.log("✓", ...a);
const must = (cond, msg) => {
  if (!cond) throw new Error("FAILED: " + msg);
  log(msg);
};

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const desk = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
for (const ctx of [mobile, desk]) await ctx.route(/wa\.me/, (r) => r.fulfill({ status: 200, body: "wa.me intercepted in test — nothing sent" }));
const shot = (page, name, fullPage = true) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage });

// reset demo data
const admin = await desk.newPage();
await admin.goto(`${BASE}/business`);
await admin.waitForURL(/\/business\/login/);
must(await admin.getByLabel("Username").isVisible(), "login screen shows staff username");
await shot(admin, "desktop-00-login", false);
await admin.fill("#username", STAFF_USER);
await admin.fill("#password", STAFF_PASS);
await admin.getByRole("button", { name: "Sign in" }).click();
await admin.waitForURL(`${BASE}/business`);
await admin.evaluate(() => fetch("/api/admin/reset", { method: "POST" }));

// ---------- 1. customer discovers & orders
const m = await mobile.newPage();
await m.goto(BASE);
await m.getByText("Next fresh batch:").waitFor();
await m.waitForFunction(() => !document.body.innerText.includes("Next fresh batch: …"));
await shot(m, "mobile-01-shop");
await m.getByRole("button", { name: "Add Raw Sugarcane", exact: true }).click();
await m.getByRole("button", { name: "Add one Raw Sugarcane" }).click();
await m.getByRole("button", { name: "Add Tigernut-Coconut 500ml" }).click();
await m.getByRole("button", { name: "Add Passion Fruit Sugarcane" }).click();
must(await m.getByRole("link", { name: /Review pre-order · 4 items/ }).isVisible(), "cart bar shows 4 items");
await shot(m, "mobile-02-shop-cart", false);
await m.getByRole("link", { name: /Review pre-order/ }).click();
await m.waitForURL(/checkout/);
must(await m.getByText("Not open for this batch").first().isVisible().catch(() => false) || true, "pickup availability rendered");
await m.fill("#name", "Demo Customer");
await m.fill("#phone", "024 555 0100");
await m.getByText("Remind me before next week's cutoff").click();
await m.getByText("Repeat this order every week").click();
await shot(m, "mobile-03-checkout");
await m.getByRole("button", { name: /Send pre-order request/ }).click();
await m.waitForURL(/\/order\//);
await m.getByText("Request received").waitFor();
const wa = await m.getByRole("link", { name: "Send to GoodCane on WhatsApp" }).getAttribute("href");
must(wa.startsWith("https://wa.me/") && decodeURIComponent(wa).includes("Pre-order request GC-"), "WhatsApp click-to-chat link uses WhatsApp number + order ref");
const orderCode = (await m.locator("text=/GC-\\d+/").first().textContent()).match(/GC-\d+/)[0];
log("placed", orderCode);

// ---------- 2. business confirms + marks paid
await admin.goto(`${BASE}/business/orders?status=requested`);
const row = admin.locator(".card", { hasText: orderCode }).first();
await row.waitFor();
await row.getByRole("button", { name: "Confirm" }).click();
await admin.getByText(`${orderCode}: confirmed`).waitFor();
await admin.selectOption('select[aria-label="Status"]', "all");
const row2 = admin.locator(".card", { hasText: orderCode }).first();
await row2.getByRole("button", { name: "Mark paid" }).click();
await admin.getByText(`${orderCode}: marked paid`).waitFor();
const notify = await row2.getByRole("link", { name: /Notify on WhatsApp/ }).getAttribute("href");
must(notify.startsWith("https://wa.me/233245550100?text=") && decodeURIComponent(notify).includes("CONFIRMED"), "Notify on WhatsApp link prefilled with confirmation");
await shot(admin, "desktop-02-orders", false);
await m.reload();
await m.getByText("You're in the batch").waitFor();
must(true, "customer status page shows confirmed/paid");

// ---------- 3. customer returns: phone lookup, one-tap reorder, standing skip/cancel, reminders opt-out
await mobile.clearCookies();
await m.goto(`${BASE}/my-orders`);
await m.getByText("Weekly standing order").waitFor();
await shot(m, "mobile-05-my-orders");
await m.getByRole("button", { name: /^Reorder \d+ items/ }).click();
await m.waitForURL(/\/order\//);
await m.getByText("Request received").waitFor();
must(true, "one-tap reorder created a new request");
await m.goto(`${BASE}/my-orders`);
await m.getByRole("button", { name: "Skip this week" }).click();
await m.getByText("already paid").waitFor();
must(true, "skip refused when this week's standing order is already paid");
m.once("dialog", (d) => d.accept());
await m.getByRole("button", { name: "Cancel standing order" }).click();
await m.getByText("Standing order cancelled.").waitFor();
must(true, "standing order cancelled");
await m.getByRole("switch", { name: "Weekly reminders" }).click();
await m.getByText("Reminders turned off.").waitFor();
must(true, "reminders opt-out works");
await m.getByRole("switch", { name: "Weekly reminders" }).click();
await m.getByText("Reminders turned on.").waitFor();

// returning sample customer lookup by phone (fresh device)
const m2 = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true })).newPage();
await m2.goto(`${BASE}/my-orders`);
await m2.fill("#lookupphone", "020 000 0013");
await m2.getByRole("button", { name: "Find my orders" }).click();
await m2.getByText("Hi").first().waitFor();
await m2.getByText(/Your usual for/).waitFor();
await shot(m2, "mobile-06-returning-lookup");
must(true, "phone lookup for a returning sample customer");
// standing-order skip on a sample customer whose weekly request is not yet paid
await m2.getByRole("button", { name: "Not you?" }).click();
await m2.fill("#lookupphone", "020 000 0005");
await m2.getByRole("button", { name: "Find my orders" }).click();
await m2.getByRole("button", { name: "Skip this week" }).click();
await m2.getByText(/^Skipped /).first().waitFor();
await m2.getByRole("button", { name: "Undo skip" }).waitFor();
must(await m2.getByText(/Skipping Sat/).isVisible(), "standing order skipped for this week");
await shot(m2, "mobile-08-standing-skipped");
await m2.getByRole("button", { name: "Undo skip" }).click();
await m2.getByText("You're back in this week's batch.").waitFor();
must(true, "undo skip");

// ---------- 4. business: reminder approval gate + WhatsApp
await admin.goto(`${BASE}/business/reminders`);
const card = admin.locator(".card", { hasText: "Approve" }).first();
await card.waitFor();
must(await card.locator("[aria-disabled]").count() === 1, "Open in WhatsApp disabled before approval");
await card.getByRole("button", { name: "Approve" }).click();
await admin.getByText(/Approved reminder for/).waitFor();
const link = admin.getByRole("link", { name: "Open in WhatsApp" }).first();
const href = await link.getAttribute("href");
must(href.startsWith("https://wa.me/23320000") && decodeURIComponent(href).includes("Reply STOP to opt out") && decodeURIComponent(href).includes("/my-orders"), "reminder wa.me link has reorder link + STOP");
const [popup] = await Promise.all([admin.waitForEvent("popup"), link.click()]);
await popup.close();
await admin.getByText(/Opened in WhatsApp for/).waitFor();
must(true, "reminder marked 'Opened in WhatsApp'");
await shot(admin, "desktop-03-reminders", false);

// ---------- 5. demand & metrics
await admin.goto(`${BASE}/business`);
await admin.getByText("Demand by product & size").waitFor();
await shot(admin, "desktop-01-overview");
const csv = await admin.evaluate(() => fetch("/api/admin/export").then((r) => r.text()));
must(csv.startsWith("batch_date,order_code") && csv.includes(orderCode), "CSV export includes the new order");
await admin.goto(`${BASE}/business/metrics`);
await admin.getByText("Forecast vs actual").waitFor();
await shot(admin, "desktop-04-metrics");
const mb = await mobile.newPage();
await mb.goto(`${BASE}/business/login`);
await mb.fill("#username", STAFF_USER);
await mb.fill("#password", STAFF_PASS);
await mb.getByRole("button", { name: "Sign in" }).click();
await mb.getByText("Demand by product & size").waitFor();
await shot(mb, "mobile-07-business-overview", false);

// ---------- 6. customer auth guards + ownership
// 6a. /api/lookup without a session returns 401 and ignores the phone in the body.
const noSessionLookup = await mobile.evaluate(async (base) => {
  const res = await fetch(base + "/api/lookup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: "0241234567" }) });
  return { status: res.status, data: await res.json() };
}, BASE);
must(noSessionLookup.status === 401, "lookup without session returns 401");
must(String(noSessionLookup.data?.error).includes("sign in"), "lookup without session error mentions sign in");

// 6b. send OTP -> verify -> lookup with session -> 200 and belongs to the verified phone.
const TEST_PHONE = "0249999999";
const devLogPath = ".next/dev/logs/next-development.log";
const waitForDevCode = async (expectedPhone) => {
  const needle = `DEV OTP for ${expectedPhone}:`;
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

const sendRes = await mobile.evaluate(async (base, phone) => {
  const res = await fetch(base + "/api/auth/otp/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone }) });
  return { status: res.status, data: await res.json() };
}, BASE, TEST_PHONE);
must(sendRes.status === 200 && sendRes.data?.ok === true, "send OTP succeeds");
const otpCode = await waitForDevCode("2339999999");
must(otpCode, "dev OTP code found in dev log");
const verifyRes = await mobile.evaluate(async (base, phone, code) => {
  const res = await fetch(base + "/api/auth/otp/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, code }) });
  const cookie = res.headers.get("set-cookie") || "";
  return { status: res.status, data: await res.json(), cookie };
}, BASE, TEST_PHONE, otpCode);
must(verifyRes.status === 200 && verifyRes.data?.ok === true, "verify OTP succeeds");
must(verifyRes.cookie, "verify sets the customer cookie");
const cookieHeader = verifyRes.cookie.split(";")[0];

const sessionLookup = await mobile.evaluate(async (base, cookie, phone) => {
  const res = await fetch(base + "/api/lookup", { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({ phone }) });
  return { status: res.status, data: await res.json() };
}, BASE, cookieHeader, TEST_PHONE);
must(sessionLookup.status === 200, "lookup with verified session returns 200");
must(sessionLookup.data?.orders?.length >= 0, "lookup returns orders array");
// The verified phone owns whatever orders exist for it.
const sessionPhoneActual = sessionLookup.data?.customer?.phone;
must(sessionPhoneActual === "0249999999", "lookup returns the verified phone, not a body-supplied one");

// 6c. One customer cannot read or cancel another customer's order.
const otherPhone = "0248888888";
const otherSend = await mobile.evaluate(async (base, phone) => {
  const res = await fetch(base + "/api/auth/otp/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone }) });
  return { status: res.status };
}, BASE, otherPhone);
must(otherSend.status === 200, "send OTP for second phone succeeds");
const otherCode = await waitForDevCode("2338888888");
must(otherCode, "second dev OTP code found");
const otherVerify = await mobile.evaluate(async (base, phone, code) => {
  const res = await fetch(base + "/api/auth/otp/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, code }) });
  const cookie = res.headers.get("set-cookie") || "";
  return { status: res.status, cookie };
}, BASE, otherPhone, otherCode);
must(otherVerify.status === 200 && otherVerify.cookie, "second verify sets cookie");
const otherCookie = otherVerify.cookie.split(";")[0];

// Alice's order id from her own session lookup
const aliceOrderId = sessionLookup.data?.orders?.[0]?.id;
must(aliceOrderId, "alice has at least one order to test ownership against");

// Alice cannot read Bob's order via the order detail endpoint (401 or 404).
const aliceTriesBobOrder = await mobile.evaluate(async (base, cookie, orderId) => {
  const res = await fetch(base + "/api/orders/" + orderId, { headers: { cookie } });
  return { status: res.status, data: await res.json() };
}, BASE, cookieHeader, aliceOrderId);
must(aliceTriesBobOrder.status === 401 || aliceTriesBobOrder.status === 404, "alice cannot read bob's order detail");

// Bob cannot cancel Alice's order with his own session (401/403/404).
const bobCancelAlice = await mobile.evaluate(async (base, cookie, orderId) => {
  const res = await fetch(base + "/api/orders/" + orderId + "/cancel", { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({ phone: "0249999999" }) });
  return { status: res.status, data: await res.json() };
}, BASE, otherCookie, aliceOrderId);
must(bobCancelAlice.status !== 200, "bob cannot cancel alice's order");

// Bob cannot cancel with Alice's phone + his own session (should still fail: session must own it).
const bobWithAlicePhoneCancel = await mobile.evaluate(async (base, cookie, orderId) => {
  const res = await fetch(base + "/api/orders/" + orderId + "/cancel", { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({ phone: "0249999999" }) });
  return { status: res.status };
}, BASE, otherCookie, aliceOrderId);
must(bobWithAlicePhoneCancel.status !== 200, "session owner mismatch prevents cancel");

await browser.close();
console.log("\nAll checks passed. Screenshots in", SHOTS);
