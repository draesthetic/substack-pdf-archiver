// One-time login. Opens a real browser window, you sign into Substack by hand,
// then we save the session to storageState.json so the archiver runs unattended.
//
// This is per-ACCOUNT, not per-publication: Substack uses one sign-in for your
// whole account, so the saved session works for every paid pub you subscribe to.
import { chromium } from "playwright";
import { STORAGE_STATE } from "./config.js";

const run = async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("https://substack.com/sign-in", { waitUntil: "domcontentloaded" });

  console.log("\n→ A browser window opened.");
  console.log("→ Sign into your Substack account (the one with your paid subscriptions).");
  console.log("→ Once you're logged in, come back here and press Enter.\n");

  await new Promise((resolve) => process.stdin.once("data", resolve));

  await context.storageState({ path: STORAGE_STATE });
  console.log(`✓ Session saved to ${STORAGE_STATE}.`);
  console.log(`  Now run e.g.:  node archive.js foo.substack.com`);

  await browser.close();
  process.exit(0);
};

run();
