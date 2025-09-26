//@ts-nocheck
import {
  chromium,
  Page,
  ElementHandle,
  BrowserContext,
  Browser,
} from "playwright";
import * as fs from "fs-extra";
import * as path from "path";
import { format as csvFormat } from "@fast-csv/format";
import {
  subDays,
  subWeeks,
  subMonths,
  subYears,
  format as dfFormat,
} from "date-fns";

const REVIEW_LIMIT = parseInt(process.env.REVIEW_LIMIT || "20", 10);

// Random pause
function pause(min = 500, max = 1500) {
  return new Promise((resolve) =>
    setTimeout(resolve, Math.random() * (max - min) + min),
  );
}

// Human-like typing
async function typeSlow(page, selector, text) {
  for (const char of text) {
    await page.type(selector, char, { delay: 100 + Math.random() * 100 });
    await pause(50, 150);
  }
}

export async function scrapeGoogleMapsData(targetPlace: string) {
  const browser = await chromium.launch({ headless: false, slowMo: 50 });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  try {
    console.log("🌍 Opening Google Maps...");
    await page.goto("https://www.google.com/maps", {
      waitUntil: "domcontentloaded",
    });

    // Handle consent popup
    try {
      const consentBtn = page.locator("button:has-text('Accept all')");
      if (await consentBtn.isVisible({ timeout: 5000 })) {
        await page.mouse.move(100, 100); // move mouse
        await pause(500, 1000);
        await consentBtn.click();
        console.log("✅ Accepted consent popup");
      }
    } catch {}

    console.log(`🔎 Searching for: ${targetPlace}`);
    await page.mouse.move(200, 200);
    await pause(300, 600);
    await typeSlow(page, "input#searchboxinput", targetPlace);
    await pause(300, 600);
    await page.press("input#searchboxinput", "Enter");

    // Click the first search result from the left sidebar
    try {
      console.log("⏳ Waiting for search results...");
      const firstResult = page
        .locator('div[role="article"].Nv2PK:has(a.hfpxzc)')
        .first();
      const firstAlt = page.locator('div[role="feed"] div.Nv2PK').first();

      await Promise.race([
        firstResult
          .waitFor({ state: "visible", timeout: 20000 })
          .catch(() => null),
        firstAlt
          .waitFor({ state: "visible", timeout: 20000 })
          .catch(() => null),
      ]);

      if (await firstResult.isVisible().catch(() => false)) {
        await pause(400, 800);
        await firstResult.click();
        console.log("✅ Opened first search result (primary)");
      } else if (await firstAlt.isVisible().catch(() => false)) {
        await pause(400, 800);
        await firstAlt.click();
        console.log("✅ Opened first search result (fallback)");
      } else {
        console.log(
          "⚠️ No visible search result card; proceeding without explicit selection",
        );
      }

      // Give time for place panel to load
      await pause(1200, 1800);
    } catch (e) {
      console.log("⚠️ Could not click first result:", e.message);
    }

    console.log("⏳ Waiting for sidebar...");
    const reviewsBtn = page.locator(
      'button:has(div.Gpq6kf.NlVald:has-text("Reviews"))',
    );
    await reviewsBtn.waitFor({ state: "visible", timeout: 20000 });

    console.log("📝 Clicking on Reviews...");
    await page.mouse.move(300 + Math.random() * 50, 300 + Math.random() * 50);
    await pause(500, 1000);
    await reviewsBtn.click();
    await pause(1500, 2500);

    // Robust scrollable container for reviews, with fallbacks
    let scrollable = page
      .locator('div[aria-label*="reviews"], div[aria-label*="Reviews"]')
      .filter({ has: page.locator("div.jftiEf") })
      .first();

    if (!(await scrollable.isVisible().catch(() => false))) {
      scrollable = page
        .locator("div.m6QErb.DxyBCb")
        .filter({ has: page.locator("div.jftiEf") })
        .first();
    }

    if (!(await scrollable.isVisible().catch(() => false))) {
      const feed = page.getByRole("feed"); // e.g., Results feed if still on list
      if (await feed.isVisible().catch(() => false)) {
        scrollable = feed.first();
      }
    }

    await scrollable.waitFor({ state: "visible", timeout: 20000 });

    console.log("⬇️ Scrolling and scraping reviews...");
    let reviews = [];
    let retries = 0;

    while (reviews.length < REVIEW_LIMIT && retries < 20) {
      // Scroll slowly in small steps
      for (let i = 0; i < 5; i++) {
        await scrollable.evaluate((el) =>
          el.scrollBy(0, Math.floor(Math.random() * 100 + 50)),
        );
        await pause(400, 800);
      }

      // Extract reviews incrementally
      const newReviews = await page.$$eval("div.jftiEf", (cards) =>
        cards.map((card) => {
          const name = card.querySelector(".d4r55")?.innerText || null;
          const rating =
            card.querySelector(".kvMYJc")?.getAttribute("aria-label") || null;
          const text = card.querySelector(".wiI7pd")?.innerText || null;
          const date = card.querySelector(".rsqaWe")?.innerText || null;
          return { name, rating, text, date };
        }),
      );

      // Deduplicate
      const ids = new Set(reviews.map((r) => r.name + r.date + r.text));
      for (const r of newReviews) {
        const key = r.name + r.date + r.text;
        if (!ids.has(key)) {
          reviews.push(r);
          ids.add(key);
        }
      }

      console.log(`📊 Loaded ${reviews.length} reviews...`);
      retries++;
    }

    console.log(`✅ Scraped ${reviews.length} reviews`);

    // Return the scraped data instead of writing to file
    const scrapedData = reviews.slice(0, REVIEW_LIMIT);
    return scrapedData;
  } catch (err) {
    console.error("❌ Scrape failed:", err.message);
    throw err;
  } finally {
    await browser.close();
  }
}

// Allow running as standalone script
if (require.main === module) {
  const TARGET_PLACE = process.env.TARGET_PLACE || "titan";
  const OUTPUT_FILE = path.join(__dirname, "google_reviews.json");

  (async () => {
    try {
      const reviews = await scrapeGoogleMapsData(TARGET_PLACE);
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(reviews, null, 2), "utf-8");
      console.log(`💾 Saved to ${OUTPUT_FILE}`);
    } catch (error) {
      console.error("Script execution failed:", error);
      process.exit(1);
    }
  })();
}
