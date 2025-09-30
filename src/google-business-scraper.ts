// @ts-nocheck
/**
 * google-business-scraper.ts
 * Scrapes Google Business profiles for company information, posts, and updates
 */

import { chromium, Page } from "playwright";

const POSTS_LIMIT = parseInt(process.env.POSTS_LIMIT || "20", 10);

function pause(min = 1000, max = 2000) {
  return new Promise((resolve) =>
    setTimeout(resolve, Math.random() * (max - min) + min),
  );
}

/**
 * Scrapes Google Business profile posts and updates
 * @param businessName - The business name to search for
 * @returns Array of structured business posts and information
 */
export async function scrapeGoogleBusinessPosts(
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
    console.log(`🏢 Searching Google Business for: ${businessName}`);

    // Search for the business on Google
    await page.goto("https://www.google.com/search", {
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

    // Search for the business
    console.log(`🔎 Searching for business: ${businessName}`);
    await page.fill("input[name='q']", `${businessName} business`);
    await page.press("input[name='q']", "Enter");
    await pause(2000, 3000);

    // Look for business knowledge panel or Maps link
    let businessPanel = null;
    const panelSelectors = [
      "[data-attrid='kc:/business/business:knowledge_panel']",
      ".kp-wholepage",
      ".knowledge-panel",
      ".mod",
      "[data-ved*='business']",
    ];

    for (const selector of panelSelectors) {
      try {
        businessPanel = page.locator(selector);
        if ((await businessPanel.count()) > 0) {
          break;
        }
      } catch {}
    }

    if (!businessPanel || (await businessPanel.count()) === 0) {
      // Try to find a Maps link to click
      const mapsLink = page.locator('a[href*="maps.google.com"]').first();
      if ((await mapsLink.count()) > 0) {
        console.log("📍 Navigating to Google Maps...");
        await mapsLink.click();
        await page.waitForLoadState("domcontentloaded");
        await pause(2000, 3000);
      } else {
        throw new Error(
          `Could not find business panel or maps link for ${businessName}`,
        );
      }
    }

    // Extract basic business information
    const businessInfo = await page.evaluate(() => {
      const getTextBySelectors = (selectors: string[]) => {
        for (const selector of selectors) {
          const el = document.querySelector(selector);
          if (el) return el.textContent?.trim() || null;
        }
        return null;
      };

      const getAttributeBySelectors = (
        selectors: string[],
        attribute: string,
      ) => {
        for (const selector of selectors) {
          const el = document.querySelector(selector);
          if (el) return el.getAttribute(attribute) || null;
        }
        return null;
      };

      // Try to extract business information
      const businessName = getTextBySelectors([
        "h1",
        ".qrShPb",
        "[data-attrid*='title']",
        ".kno-ecr-pt",
      ]);

      const rating = getTextBySelectors([
        "[data-attrid*='rating']",
        ".Aq14fc",
        ".review-score",
        "[aria-label*='star']",
      ]);

      const address = getTextBySelectors([
        "[data-attrid*='address']",
        ".LrzXr",
        ".address",
        "[data-local-attribute='d3adr']",
      ]);

      const phone = getTextBySelectors([
        "[data-attrid*='phone']",
        ".LrzXr[role='button']",
        "a[href^='tel:']",
      ]);

      const website = getAttributeBySelectors(
        ["a[data-attrid*='website']", "a[href*='http']"],
        "href",
      );

      const hours = getTextBySelectors([
        "[data-attrid*='hours']",
        ".OqQsEd",
        ".hours",
        "[data-local-attribute='d3oh']",
      ]);

      return {
        name: businessName,
        rating,
        address,
        phone,
        website,
        hours,
      };
    });

    // Look for posts or updates
    console.log("📝 Looking for business posts and updates...");
    let posts: any[] = [];

    // Try to find posts section
    const postSelectors = [
      "[data-attrid*='posts']",
      ".posts",
      ".update",
      ".business-post",
      "[data-ved*='posts']",
    ];

    let postsFound = false;
    for (const selector of postSelectors) {
      try {
        const postsContainer = page.locator(selector);
        if ((await postsContainer.count()) > 0) {
          console.log(`Found posts container with selector: ${selector}`);

          // Extract posts from this container
          const extractedPosts = await postsContainer.evaluate((container) => {
            const postElements = container.querySelectorAll(
              "div, article, section",
            );
            const posts = [];

            for (const el of postElements) {
              const text = el.textContent?.trim();
              if (text && text.length > 20 && text.length < 1000) {
                // Try to extract date
                const dateEl = el.querySelector("[data-date], .date, time");
                const date =
                  dateEl?.textContent?.trim() ||
                  dateEl?.getAttribute("datetime") ||
                  null;

                posts.push({
                  text: text.slice(0, 500),
                  date,
                  type: "business_post",
                  source: "google_business",
                });
              }
            }

            return posts.slice(0, 10); // Limit posts
          });

          posts.push(...extractedPosts);
          postsFound = true;
          break;
        }
      } catch (e) {
        console.log(`Failed with posts selector ${selector}:`, e.message);
      }
    }

    // If no posts found directly, try to extract any update-like content
    if (!postsFound) {
      console.log("📰 Looking for general business updates...");

      const updates = await page.evaluate(() => {
        const textElements = document.querySelectorAll("p, div, span");
        const updates = [];

        for (const el of textElements) {
          const text = el.textContent?.trim() || "";

          // Look for content that might be business updates
          if (
            text.length > 50 &&
            text.length < 800 &&
            (text.includes("update") ||
              text.includes("new") ||
              text.includes("announce") ||
              text.includes("offer") ||
              text.includes("service") ||
              text.includes("product"))
          ) {
            updates.push({
              text: text.slice(0, 500),
              date: null,
              type: "business_update",
              source: "google_business",
            });
          }
        }

        return updates.slice(0, 5);
      });

      posts.push(...updates);
    }

    // Create structured result
    const result = [];

    // Add business info as first item
    const businessData = {
      ...businessInfo,
      source: "google_business",
      type: "business_info",
      scraped_at: new Date().toISOString(),
      posts_count: posts.length,
    };
    result.push(businessData);

    // Add posts with timestamp
    posts.forEach((post) => {
      result.push({
        ...post,
        business_name: businessName,
        scraped_at: new Date().toISOString(),
      });
    });

    console.log(
      `✅ Scraped ${result.length} items for ${businessName} from Google Business`,
    );
    return result;
  } catch (error) {
    console.error(
      `❌ Google Business scrape failed for ${businessName}:`,
      error.message,
    );
    throw error;
  } finally {
    await browser.close();
  }
}

/**
 * Main function to scrape Google Business data
 * @param businessName - The business name to search for
 * @returns Array of business information and posts
 */
export async function scrapeGoogleBusinessData(
  businessName: string,
): Promise<any[]> {
  try {
    return await scrapeGoogleBusinessPosts(businessName);
  } catch (error) {
    console.error(
      `Error scraping Google Business data for ${businessName}:`,
      error,
    );
    throw error;
  }
}

scrapeGoogleBusinessData("OpenAI").then((data) => {
  console.log("Scraped Data:", data);
});
