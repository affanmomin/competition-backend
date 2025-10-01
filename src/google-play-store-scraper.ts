// @ts-nocheck
/**
 * google-play-store-scraper.ts
 *
 * Opens a Google Play product page URL, opens the
 * "See more information on Ratings and reviews" modal (or full reviews page),
 * and scrapes reviews into a structured dataset.
 *
 * This module now exports a reusable function:
 *   scrapeGooglePlayStoreReviews(playStoreUrl: string, options?)
 * that returns an array of review objects. No files are written by default.
 */

import { chromium, Page, Locator } from "playwright";
import * as fs from "fs";
import * as path from "path";

// Tunables (can be overridden via options)
const DEFAULTS = {
  maxReviews: 50,
  scrollBatches: 60,
  scrollStep: 650,
  readMoreClickLimit: 150,
  headless: process.env.PLAYWRIGHT_HEADLESS
    ? process.env.PLAYWRIGHT_HEADLESS === "true"
    : true,
  slowMo: process.env.PLAYWRIGHT_SLOWMO
    ? Number(process.env.PLAYWRIGHT_SLOWMO)
    : 0,
};

const BUTTON_ARIA = "See more information on Ratings and reviews";

// ---------- tiny helpers ----------
const rand = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const waitTiny = (p: Page, lo = 150, hi = 350) =>
  p.waitForTimeout(rand(lo, hi));
const waitMed = (p: Page, lo = 350, hi = 900) => p.waitForTimeout(rand(lo, hi));

function toCsvValue(v: any) {
  if (v == null) return "";
  const s = String(v).replace(/"/g, '""');
  return /[,"\n]/.test(s) ? `"${s}"` : s;
}
function saveCSV(filename: string, rows: Record<string, any>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const r of rows)
    lines.push(headers.map((h) => toCsvValue(r[h])).join(","));
  fs.writeFileSync(filename, lines.join("\n"), "utf-8");
}

// ---------- core: open modal by aria-label globally with progressive scroll ----------
async function openRatingsInfoModal(page: Page): Promise<"modal" | "page"> {
  // Load & give the SPA time to hydrate
  // page.goto will have been called by the caller
  await page
    .waitForLoadState("networkidle", { timeout: 15000 })
    .catch(() => {});
  await waitMed(page);

  const btn = page.getByRole("button", { name: BUTTON_ARIA }).first();

  // Progressive scroll until button is attached & visible
  let found = false;
  for (let i = 0; i < 14; i++) {
    if (await btn.count()) {
      try {
        await btn.scrollIntoViewIfNeeded();
        if (await btn.isVisible()) {
          found = true;
          break;
        }
      } catch {}
    }
    await page.mouse.wheel(0, rand(500, 900));
    await waitTiny(page);
  }

  if (!found) {
    const anyBtn = page.locator(`button[aria-label="${BUTTON_ARIA}"]`).first();
    if (await anyBtn.count()) {
      try {
        await anyBtn.scrollIntoViewIfNeeded();
        if (await anyBtn.isVisible()) {
          await anyBtn.click({ delay: rand(40, 120) });
        }
      } catch {}
    } else {
      // Fallback: try an “All reviews” entry globally
      const seeAll = page
        .locator(
          'a:has-text("All reviews"), button:has-text("All reviews"), a:has-text("See all reviews"), button:has-text("See all reviews")',
        )
        .first();
      if (await seeAll.count()) {
        await seeAll.scrollIntoViewIfNeeded().catch(() => {});
        await seeAll.click({ delay: 60 });
        await page.waitForLoadState("domcontentloaded");
        return "page";
      }
      throw new Error(
        "Could not find Ratings info button or All reviews entry.",
      );
    }
  } else {
    await btn.click({ delay: rand(40, 120) });
  }

  // Wait for modal
  const dialog = page.locator('div[role="dialog"]').first();
  try {
    await dialog.waitFor({ state: "visible", timeout: 6000 });
    return "modal";
  } catch {
    return "page";
  }
}

// ---------- scraping ----------
export interface PlayStoreReview {
  review_id: string | null;
  author: string | null;
  rating: number | null;
  date: string | null;
  text: string;
  helpful_count: number;
  developer_response_date: string | null;
  developer_response_text: string | null;
}

export interface PlayStoreScrapeOptions {
  maxReviews?: number;
  scrollBatches?: number;
  scrollStep?: number;
  readMoreClickLimit?: number;
  headless?: boolean;
  slowMo?: number;
  proxy?: {
    server: string;
    username?: string;
    password?: string;
  };
  saveToDisk?: boolean; // for debugging local runs
}

export async function scrapeGooglePlayStoreReviews(
  playStoreUrl: string,
  options: PlayStoreScrapeOptions = {},
): Promise<PlayStoreReview[]> {
  const cfg = { ...DEFAULTS, ...options };

  // Optional disk save
  const OUTPUT_DIR = path.resolve(process.cwd(), "out");

  const browser = await chromium.launch({
    headless: false,
    proxy: {
      server: "http://gw.dataimpulse.com:823",
      username: "2cef711aaa1a060b00b2",
      password: "71e56626760e1077",
    },
  });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    locale: "en-US",
  });
  const page = await context.newPage();

  try {
    console.log("Visiting:", playStoreUrl);
    await page.goto(playStoreUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await waitMed(page);

    const mode = await openRatingsInfoModal(page);
    const dialog = page.locator('div[role="dialog"]').first();
    const root: Locator = mode === "modal" ? dialog : page.locator("body");

    if (mode === "modal") {
      await dialog.waitFor({ state: "visible", timeout: 10000 });
      await waitMed(page);
    } else {
      // Nudge the reviews list on the page
      for (let i = 0; i < 2; i++) {
        await page.mouse.wheel(0, rand(400, 800));
        await waitTiny(page);
      }
    }

    // Find a scrollable container within root
    const scrollableHandle = await root.evaluateHandle(
      (rootEl: HTMLElement) => {
        function findScrollable(root: HTMLElement): HTMLElement {
          const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
          while (w.nextNode()) {
            const el = w.currentNode as HTMLElement;
            const st = window.getComputedStyle(el);
            if (
              (st.overflowY === "auto" || st.overflowY === "scroll") &&
              el.scrollHeight > el.clientHeight &&
              el.clientHeight > 0
            )
              return el;
          }
          return root;
        }
        return findScrollable(rootEl);
      },
    );

    // Get an ElementHandle and use elementHandle.evaluate so we can pass a single arg.
    const scrollEl = scrollableHandle.asElement();
    if (!scrollEl) throw new Error("Scrollable handle is not an element");

    async function expandReadMores(limit = cfg.readMoreClickLimit) {
      let clicks = 0;
      const buttons = root.locator(
        'button:has-text("Full Review"), button:has-text("Read more"), div[role="button"]:has-text("Read more")',
      );
      const count = await buttons.count();
      for (let i = 0; i < count && clicks < limit; i++) {
        const b = buttons.nth(i);
        if (await b.isVisible()) {
          await b.click({ delay: rand(20, 100) }).catch(() => {});
          clicks++;
          await waitTiny(page, 120, 240);
        }
      }
    }

    const seen = new Set<string>();
    const reviews: PlayStoreReview[] = [];

    for (let batch = 0; batch < cfg.scrollBatches; batch++) {
      await expandReadMores();

      const extracted = await root.evaluate((rootEl: HTMLElement) => {
        const nodes = Array.from(
          rootEl.querySelectorAll(".RHo1pe"),
        ) as HTMLElement[];

        const parseIntFromText = (txt: string | null) => {
          if (!txt) return null;
          const m = txt.replace(/,/g, "").match(/\d+/);
          return m ? parseInt(m[0], 10) : null;
        };
        const getRatingFromLabel = (el: Element | null) => {
          if (!el) return null;
          const al = (el.getAttribute("aria-label") || "").trim();
          const m = al.match(/Rated\s+(\d+)/i);
          return m ? parseInt(m[1], 10) : null;
        };

        const pack: any[] = [];
        for (const n of nodes) {
          const header = n.querySelector(
            "header[data-review-id]",
          ) as HTMLElement | null;
          const review_id = header?.getAttribute("data-review-id") || null;

          const author =
            n.querySelector(".X5PpBb")?.textContent?.trim() || null;
          const date =
            n.querySelector(".Jx4nYe .bp9Aid")?.textContent?.trim() || null;

          const ratingEl = n.querySelector('.Jx4nYe [aria-label^="Rated"]');
          const rating = getRatingFromLabel(ratingEl);

          const body = n.querySelector(".h3YV2d")?.textContent?.trim() || "";

          const helpfulText =
            n.querySelector(".AJTPZc")?.textContent?.trim() || "";
          const helpful_count = parseIntFromText(helpfulText) || 0;

          const devBlock = n.nextElementSibling?.classList.contains("ocpBU")
            ? (n.nextElementSibling as HTMLElement)
            : n.querySelector(".ocpBU");

          let developer_response_date: string | null = null;
          let developer_response_text: string | null = null;
          if (devBlock) {
            developer_response_date =
              devBlock.querySelector(".I9Jtec")?.textContent?.trim() || null;
            developer_response_text =
              devBlock.querySelector(".ras4vb")?.textContent?.trim() ||
              devBlock.querySelector(".ras4vb div")?.textContent?.trim() ||
              null;
            if (developer_response_text) {
              developer_response_text = developer_response_text
                .replace(/\s+\n\s+/g, "\n")
                .trim();
            }
          }

          pack.push({
            review_id,
            author,
            rating,
            date,
            text: body,
            helpful_count,
            developer_response_date,
            developer_response_text,
          });
        }
        return pack;
      });

      for (const r of extracted) {
        if (r.review_id && !seen.has(r.review_id)) {
          seen.add(r.review_id);
          reviews.push(r);
        }
      }
      if (reviews.length >= cfg.maxReviews) break;

      // ✅ Use elementHandle.evaluate with a SINGLE argument (step)
      const step = rand(cfg.scrollStep - 120, cfg.scrollStep + 220);
      await scrollEl.evaluate((el, s) => {
        const node = el as HTMLElement;
        if (node && typeof (node as any).scrollBy === "function") {
          node.scrollBy({ top: s as number, behavior: "auto" });
        } else {
          window.scrollBy({ top: s as number, behavior: "auto" });
        }
      }, step);

      await waitMed(page);
    }

    if (cfg.saveToDisk) {
      if (!fs.existsSync(OUTPUT_DIR))
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
      // Try to infer app id from URL for filenames
      const idMatch = /[?&]id=([^&]+)/.exec(playStoreUrl);
      const appId = idMatch ? decodeURIComponent(idMatch[1]) : "playstore";
      const jsonPath = path.join(OUTPUT_DIR, `${appId}.reviews.json`);
      const csvPath = path.join(OUTPUT_DIR, `${appId}.reviews.csv`);
      fs.writeFileSync(jsonPath, JSON.stringify(reviews, null, 2), "utf-8");
      saveCSV(csvPath, reviews as any[]);
      console.log(`✅ Scraped ${reviews.length} reviews`);
      console.log(`→ JSON: ${jsonPath}`);
      console.log(`→ CSV : ${csvPath}`);
    }

    return reviews;
  } finally {
    await context.close();
    await browser.close();
  }
}
// Optional: CLI runner for local testing
if (require.main === module) {
  const urlArg = process.argv[2];
  if (!urlArg) {
    console.error(
      "Usage: ts-node src/google-play-store-scraper.ts <PLAY_STORE_APP_URL>",
    );
    process.exit(1);
  }
  scrapeGooglePlayStoreReviews(urlArg, { saveToDisk: true, headless: false })
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
