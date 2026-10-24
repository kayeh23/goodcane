// End-to-end check of the Kitchen Pack Sheet (/business/packing).
// Usage: BASE_URL=http://localhost:3000 DEV_STAFF_PASSWORD=dev-only node e2e/packing.mjs
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

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome-stable",
  args: ["--no-sandbox"],
});
const desk = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
const page = await desk.newPage();

// 1. Login to business desk
await page.goto(`${BASE}/business/login`);
await page.fill("#username", STAFF_USER);
await page.fill("#password", STAFF_PASS);
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL(`${BASE}/business`);
log("authenticated staff session");

// 2. Navigate to packing sheet
await page.goto(`${BASE}/business/packing`);
await page.waitForSelector("h1:has-text('Kitchen Pack Sheet')");
must(await page.getByText("Kitchen Pack Sheet").isVisible(), "rendered Kitchen Pack Sheet page title");

// 3. Verify the four location tables
await page.waitForSelector("h2:has-text('Adenta Shop Table')");
must(await page.getByRole("heading", { name: "Adenta Shop Table" }).isVisible(), "Adenta Shop Table rendered");
must(await page.getByRole("heading", { name: "Parks & Gardens Table" }).isVisible(), "Parks & Gardens Table rendered");
must(await page.getByRole("heading", { name: "Green Butterfly Table" }).isVisible(), "Green Butterfly Table rendered");
must(await page.getByRole("heading", { name: "Delivery Dispatch Table" }).isVisible(), "Delivery Dispatch Table rendered");

// 4. Test stage toggle on an order
const bottledBtn = page.getByRole("button", { name: /^Mark order GC-.* as Bottled$/ }).first();
if (await bottledBtn.isVisible()) {
  await bottledBtn.click();
  await page.waitForSelector("text=Updated order stage to");
  must(true, "toggled order packing stage to Bottled");

  const packedBtn = page.getByRole("button", { name: /^Mark order GC-.* as Packed$/ }).first();
  await packedBtn.click();
  await page.waitForSelector("text=Updated order stage to packed");
  must(true, "toggled order packing stage to Packed");

  const collectedBtn = page.getByRole("button", { name: /^Mark order GC-.* as Collected$/ }).first();
  await collectedBtn.click();
  await page.waitForSelector("text=Updated order stage to collected");
  must(true, "toggled order packing stage to Collected");
}

await page.screenshot({ path: `${SHOTS}/desktop-09-packing-sheet.png`, fullPage: true });
log("saved screenshot desktop-09-packing-sheet.png");

await browser.close();
console.log("\nAll packing checks passed successfully.");
