// @ts-nocheck
/**
 * google-maps-scraper.ts
 * Scrapes Google Maps reviews for businesses
 * Converts google-map.ts into a reusable function
 */

import { chromium, Page } from "playwright";

const REVIEW_LIMIT = parseInt(process.env.REVIEW_LIMIT || "50", 10);

function pause(min = 1000, max = 2000) {
  return new Promise((resolve) =>
    setTimeout(resolve, Math.random() * (max - min) + min),
  );
}

/**
 * Scrapes Google Maps reviews for a business
 * @param businessName - The business name to search for
 * @returns Array of structured review data
 */
export async function scrapeGoogleMapsReviews(
  businessName: string,
): Promise<any[]> {
  const browser = await chromium.launch({
    headless: false,
    proxy: {
      server: "http://gw.dataimpulse.com:823",
      username: "2cef711aaa1a060b00b2",
      password: "71e56626760e1077",
    },
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log(`🌍 Opening Google Maps for: ${businessName}`);
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

    console.log(`🔎 Searching for: ${businessName}`);
    await page.fill("input#searchboxinput", businessName);
    await page.press("input#searchboxinput", "Enter");

    console.log("⏳ Waiting for sidebar to load...");

    // Wait for search results
    await page.waitForSelector(".m6QErb", { timeout: 20000 });
    await pause(2000, 3000);

    // Look for the Reviews button - try multiple selectors
    let reviewsBtn = null;
    const reviewsSelectors = [
      'button:has(div.Gpq6kf.NlVald:has-text("Reviews"))',
      'button[data-value="Reviews"]',
      'button:has-text("Reviews")',
      'div[role="tab"]:has-text("Reviews")',
    ];

    for (const selector of reviewsSelectors) {
      try {
        reviewsBtn = page.locator(selector);
        if ((await reviewsBtn.count()) > 0) {
          break;
        }
      } catch {}
    }

    if (!reviewsBtn || (await reviewsBtn.count()) === 0) {
      throw new Error(
        "Could not find Reviews button - business may not exist or have no reviews",
      );
    }

    console.log("📝 Clicking on Reviews...");
    await reviewsBtn.first().click();
    await pause(2000, 3000);

    // Locate scrollable reviews container - try multiple selectors
    let scrollable = null;
    const scrollableSelectors = [
      "div.m6QErb.DxyBCb.kA9KIf.dS8AEf",
      "div.m6QErb",
      ".review-scroll-container",
      "[data-reviewid]",
    ];

    for (const selector of scrollableSelectors) {
      try {
        scrollable = page.locator(selector);
        if ((await scrollable.count()) > 0) {
          break;
        }
      } catch {}
    }

    if (!scrollable || (await scrollable.count()) === 0) {
      throw new Error("Could not find scrollable reviews container");
    }

    await scrollable.first().waitFor({ state: "visible", timeout: 15000 });

    console.log("⬇️ Scrolling and scraping reviews...");
    let reviews: any[] = [];
    let retries = 0;
    const maxRetries = 15;

    while (reviews.length < REVIEW_LIMIT && retries < maxRetries) {
      // Scroll down in the reviews container
      await scrollable
        .first()
        .evaluate((el) => el.scrollBy(0, el.scrollHeight));
      await pause(1500, 2500);

      // Extract reviews incrementally - try multiple selectors for review cards
      const reviewSelectors = [
        "div.jftiEf",
        "div[data-review-id]",
        ".review-item",
        "div.gws-localreviews__google-review",
      ];

      let newReviews: any[] = [];

      for (const selector of reviewSelectors) {
        try {
          newReviews = await page.$$eval(selector, (cards) =>
            cards.map((card) => {
              // Try multiple selectors for each field
              const getTextBySelectorArray = (selectors: string[]) => {
                for (const sel of selectors) {
                  const el = card.querySelector(sel);
                  if (el) return el.textContent?.trim() || null;
                }
                return null;
              };

              const name = getTextBySelectorArray([
                ".d4r55",
                ".reviewer-name",
                ".review-author-name",
                "[data-reviewer-name]",
              ]);

              const rating = getTextBySelectorArray([
                ".kvMYJc",
                ".review-rating",
                "[aria-label*='star']",
                ".stars",
              ]);

              const text = getTextBySelectorArray([
                ".wiI7pd",
                ".review-text",
                ".review-content",
                "[data-expandable-text]",
              ]);

              const date = getTextBySelectorArray([
                ".rsqaWe",
                ".review-date",
                ".review-publish-date",
                "[data-review-date]",
              ]);

              // Extract rating number from aria-label if available
              let ratingNumber = null;
              if (rating && rating.includes("star")) {
                const match = rating.match(/(\d+)\s*star/i);
                if (match) ratingNumber = parseInt(match[1]);
              }

              return {
                name,
                rating: ratingNumber || rating,
                text: text?.slice(0, 500), // Limit text length
                date,
                source: "google_maps",
                scraped_at: new Date().toISOString(),
              };
            }),
          );

          if (newReviews.length > 0) break;
        } catch (e) {
          console.log(`Failed with selector ${selector}:`, e.message);
        }
      }

      // Avoid duplicates
      const existingKeys = new Set(
        reviews.map((r) => `${r.name}${r.date}${r.text}`),
      );
      for (const review of newReviews) {
        const key = `${review.name}${review.date}${review.text}`;
        if (!existingKeys.has(key) && review.name) {
          reviews.push(review);
          existingKeys.add(key);
        }
      }

      console.log(`📊 Loaded ${reviews.length} reviews...`);
      retries++;

      // If no new reviews found in several attempts, break
      if (newReviews.length === 0) {
        retries += 2; // Penalize no results
      }
    }

    console.log(
      `✅ Scraped ${reviews.length} Google Maps reviews for ${businessName}`,
    );
    return reviews.slice(0, REVIEW_LIMIT);
  } catch (error) {
    console.error(
      `❌ Google Maps scrape failed for ${businessName}:`,
      error.message,
    );
    throw error;
  } finally {
    await browser.close();
  }
}

/**
 * Scrapes basic business information from Google Maps
 * @param businessName - The business name to search for
 * @returns Array with business info and reviews
 */
export async function scrapeGoogleMapsData(
  businessName: string,
): Promise<any[]> {
  try {
    const reviews = await scrapeGoogleMapsReviews(businessName);

    // Create a summary object with business info
    const businessInfo = {
      source: "google_maps",
      business_name: businessName,
      total_reviews: reviews.length,
      average_rating:
        reviews.length > 0
          ? reviews.reduce(
              (sum, r) => sum + (typeof r.rating === "number" ? r.rating : 0),
              0,
            ) / reviews.length
          : null,
      scraped_at: new Date().toISOString(),
    };

    return [businessInfo, ...reviews];
  } catch (error) {
    console.error(
      `Error scraping Google Maps data for ${businessName}:`,
      error,
    );
    throw error;
  }
}
