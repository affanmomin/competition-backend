//@ts-nocheck
import { chromium, Page, Locator } from "playwright";
import * as fs from "fs";
import * as path from "path";

const TARGET_PLACE = process.env.TARGET_PLACE || "Googleplex";
const REVIEW_LIMIT = parseInt(process.env.REVIEW_LIMIT || "20", 10);
const OUTPUT_FILE = path.join(__dirname, "google_reviews.json");

function pause(min = 1000, max = 2000) {
  return new Promise((resolve) =>
    setTimeout(resolve, Math.random() * (max - min) + min),
  );
}

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log("🌍 Opening Google Maps...");
    await page.goto("https://www.google.com/maps", {
      waitUntil: "domcontentloaded",
    });

    // Handle consent popup if it appears
    try {
      const consentBtn = page.locator("button:has-text('Accept all')");
      if (await consentBtn.isVisible({ timeout: 5000 })) {
        await consentBtn.click();
        console.log("✅ Accepted consent popup");
      }
    } catch {}

    console.log(`🔎 Searching for: ${TARGET_PLACE}`);
    await page.fill("input#searchboxinput", TARGET_PLACE);
    await page.press("input#searchboxinput", "Enter");

    console.log("⏳ Waiting for sidebar to load...");
    const reviewsBtn = page.locator(
      'button:has(div.Gpq6kf.NlVald:has-text("Reviews"))',
    );
    await reviewsBtn.waitFor({ state: "visible", timeout: 20000 });

    console.log("📝 Clicking on Reviews...");
    await reviewsBtn.click();
    await pause(1500, 2500);

    // Locate scrollable reviews container
    const scrollable = page.locator("div.m6QErb.DxyBCb.kA9KIf.dS8AEf"); // most robust currently
    await scrollable.waitFor({ state: "visible", timeout: 15000 });

    console.log("⬇️ Scrolling and scraping reviews...");
    let reviews = [];
    let retries = 0;

    while (reviews.length < REVIEW_LIMIT && retries < 15) {
      // Scroll down
      await scrollable.evaluate((el) => el.scrollBy(0, el.scrollHeight));
      await pause(1500, 2500);

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

      // Avoid duplicates
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
    fs.writeFileSync(
      OUTPUT_FILE,
      JSON.stringify(reviews.slice(0, REVIEW_LIMIT), null, 2),
      "utf-8",
    );
    console.log(`💾 Saved to ${OUTPUT_FILE}`);
  } catch (err) {
    console.error("❌ Scrape failed:", err.message);
  } finally {
    await browser.close();
  }
})();
