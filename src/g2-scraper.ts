// @ts-nocheck
/**
 * g2-scraper-stealth.ts (simplified)
 * Opens G2.com with stealth configurations to avoid bot detection.
 *
 * Usage:
 *   npx tsx src/g2-scraper-stealth.ts
 */

import { chromium } from "playwright";

async function run() {
  const browser = await chromium.launch({
    headless: false,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu",
      "--disable-blink-features=AutomationControlled",
    ],
    proxy: {
      server: "http://gw.dataimpulse.com:823",
      username: "2cef711aaa1a060b00b2",
      password: "71e56626760e1077",
    },
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
    geolocation: { latitude: 18.5204, longitude: 73.8567 }, // Pune, India coordinates
    permissions: ["geolocation"],
    extraHTTPHeaders: {
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "en-IN,en;q=0.9,hi;q=0.8",
      "Accept-Encoding": "gzip, deflate, br",
      DNT: "1",
      Connection: "keep-alive",
      "Upgrade-Insecure-Requests": "1",
    },
  });

  // Add stealth script to remove automation indicators
  await context.addInitScript(() => {
    // Remove webdriver property
    Object.defineProperty(navigator, "webdriver", {
      get: () => undefined,
    });

    // Mock plugins
    Object.defineProperty(navigator, "plugins", {
      get: () => [1, 2, 3, 4, 5],
    });

    // Mock languages
    Object.defineProperty(navigator, "languages", {
      get: () => ["en-US", "en"],
    });

    // Override chrome runtime
    window.chrome = {
      runtime: {},
    };

    // Override permissions
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) =>
      parameters.name === "notifications"
        ? Promise.resolve({ state: Permissions.prototype.query(parameters) })
        : originalQuery(parameters);
  });

  const page = await context.newPage();

  try {
    console.log("Navigating to G2.com...");

    // Navigate to G2 with longer timeout and proper wait conditions
    await page.goto("https://www.g2.com/", {
      timeout: 60000,
      waitUntil: "domcontentloaded",
    });

    console.log("Page loaded, waiting for content...");

    // Wait for the page to be fully loaded and JavaScript to execute
    await page.waitForLoadState("networkidle", { timeout: 30000 });

    // Check if we successfully loaded the page
    const title = await page.title();
    console.log("Page title:", title);

    // Take a screenshot to verify we're not getting the bot detection page
    await page.screenshot({ path: "g2-page.png", fullPage: true });
    console.log("Screenshot saved as g2-page.png");

    // Wait for 60 seconds as originally intended
    console.log("Waiting 60 seconds...");
    await page.waitForTimeout(60000);
  } catch (error) {
    console.error("Error during scraping:", error);

    // Take a screenshot of the error state
    try {
      await page.screenshot({ path: "g2-error.png", fullPage: true });
      console.log("Error screenshot saved as g2-error.png");
    } catch (screenshotError) {
      console.error("Could not take error screenshot:", screenshotError);
    }

    throw error;
  }

  await browser.close();
}

if (require.main === module) {
  run().catch((err) => {
    console.error("Failed:", err);
    process.exit(1);
  });
}
