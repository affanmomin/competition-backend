// @ts-nocheck
/**
 * website-scraper.ts
 * Scrapes company websites for content analysis
 * Converts scrape-prod.js into a reusable function
 */

import { chromium, Page, BrowserContext } from "playwright";
import * as cheerio from "cheerio";

const NAV_TIMEOUT_MS = 25_000;
const IDLE_WAIT_MS = 1200;
const MAX_SCROLLS = 4;
const RETRIES = 2;

// Common trackers/CDNs to block (regex)
const BLOCK_RE = new RegExp(
  [
    "googletagmanager",
    "google-analytics",
    "doubleclick",
    "gstatic/collect",
    "segment",
    "mixpanel",
    "hotjar",
    "amplitude",
    "facebook",
    "pixel",
    "fullstory",
    "intercom",
    "clarity",
    "criteo",
    "adservice",
  ].join("|"),
  "i",
);

// Query param junk to remove
const TRACK_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "mc_cid",
  "mc_eid",
  "_hsenc",
  "_hsmi",
  "igshid",
  "ref",
  "ref_src",
]);

function stripTracking(u: string) {
  try {
    const url = new URL(u);
    for (const p of TRACK_PARAMS) url.searchParams.delete(p);
    return url.toString();
  } catch {
    return u;
  }
}

function toAbs(base: string, href: string) {
  if (!href) return null;
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

function uniq(arr: string[]) {
  return [...new Set(arr.filter(Boolean))];
}

// Single O(n) cleaner
function cleanHtml(rawHtml: string, baseUrl: string) {
  const $ = cheerio.load(rawHtml, { decodeEntities: true });

  // Remove heavy/irrelevant nodes early
  $("script, noscript, link[rel='preload'], link[rel='prefetch']").remove();

  // Strip comments
  $("*")
    .contents()
    .each(function () {
      if (this.type === "comment") $(this).remove();
    });

  // Normalize links + images; strip inline handlers
  $("*").each((_, el) => {
    const attribs = el.attribs || {};
    for (const name of Object.keys(attribs)) {
      const low = name.toLowerCase();
      if (low.startsWith("on")) $(el).removeAttr(name); // onclick, etc.
      if (low === "aria-hidden" || low.startsWith("data-test"))
        $(el).removeAttr(name);
    }
  });

  $("a[href]").each((_, a) => {
    const abs = toAbs(baseUrl, $(a).attr("href"));
    if (abs) $(a).attr("href", stripTracking(abs));
  });

  $("img[src], img[data-src]").each((_, img) => {
    const src = $(img).attr("src") || $(img).attr("data-src");
    const abs = toAbs(baseUrl, src);
    if (abs) $(img).attr("src", abs);
    $(img).removeAttr("srcset"); // smaller output
  });

  // Basic minify
  return $.html()
    .replace(/\s+\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .replace(/[ \t]{2,}/g, " ");
}

async function configureRouting(context: BrowserContext, originHost: string) {
  await context.route("**/*", (route) => {
    const req = route.request();
    const url = req.url();
    const resourceType = req.resourceType();

    // Always block known trackers
    if (BLOCK_RE.test(url)) return route.abort();

    // Block heavy types (always)
    if (["media", "font"].includes(resourceType)) return route.abort();

    // Images are the heaviest — block in all modes (we only need DOM/text)
    if (resourceType === "image") return route.abort();

    // Stylesheets: allow same-origin only
    if (resourceType === "stylesheet") {
      try {
        if (new URL(url).host === originHost) return route.continue();
      } catch {}
      return route.abort();
    }

    // XHR/Fetch/Script: allow same-origin; block 3P
    if (["xhr", "fetch", "script"].includes(resourceType)) {
      try {
        if (new URL(url).host === originHost) return route.continue();
      } catch {}
      return route.abort();
    }

    // Document/navigation: allow
    return route.continue();
  });
}

async function lazyNudge(
  page: Page,
  steps = MAX_SCROLLS,
  stepPx = 1000,
  pause = 150,
) {
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, stepPx);
    await page.waitForTimeout(pause);
  }
}

async function scrapeWebsiteOnce(targetUrl: string) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  let navRes = null;
  try {
    navRes = await page.goto(targetUrl, { timeout: NAV_TIMEOUT_MS });
  } catch (e) {
    await context.close();
    await browser.close();
    throw new Error(`Navigation error: ${e.message}`);
  }

  const finalUrl = page.url();
  const originHost = (() => {
    try {
      return new URL(finalUrl).host;
    } catch {
      return "";
    }
  })();

  // Now attach strict routing optimized for the final origin
  await context.unroute("**/*");
  await configureRouting(context, originHost);

  // Light lazy-load nudge (images blocked => low bandwidth)
  await lazyNudge(page);
  await page
    .waitForLoadState("networkidle", { timeout: IDLE_WAIT_MS })
    .catch(() => {});

  // Serialize the *current* DOM (post-scripts)
  const rawHtml = await page.evaluate(() => document.documentElement.outerHTML);
  const status = navRes ? navRes.status() : null;

  await context.close();
  await browser.close();

  return { rawHtml, finalUrl, status };
}

function extractWebsiteData(rawHtml: string, finalUrl: string) {
  const clean = cleanHtml(rawHtml, finalUrl);
  const $ = cheerio.load(clean);

  const title = ($("title").first().text() || "").trim() || null;
  const description =
    $('meta[name="description"]').attr("content") ||
    $('meta[property="og:description"]').attr("content") ||
    null;

  // Extract main content text
  const bodyClone = $("body").clone();
  bodyClone.find("nav, header, footer, form, button, svg, style").remove();
  const text = bodyClone.text().replace(/\s+/g, " ").trim();

  // Extract structured data
  const headings = {
    h1: $("h1")
      .map((_, el) => $(el).text().trim())
      .get(),
    h2: $("h2")
      .map((_, el) => $(el).text().trim())
      .get(),
    h3: $("h3")
      .map((_, el) => $(el).text().trim())
      .get(),
  };

  // Extract key sections that might indicate features, services, or complaints
  const features = [];
  const services = [];

  // Look for feature-related sections
  $(
    "*:contains('feature'), *:contains('benefit'), *:contains('advantage')",
  ).each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 10 && text.length < 200) {
      features.push(text);
    }
  });

  // Look for service-related sections
  $(
    "*:contains('service'), *:contains('solution'), *:contains('product')",
  ).each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 10 && text.length < 200) {
      services.push(text);
    }
  });

  const links = uniq(
    $("a[href]")
      .map((_, a) => $(a).attr("href"))
      .get(),
  );
  const cleanedLinks = links.map(stripTracking);

  const internal = [];
  const external = [];
  const origin = (() => {
    try {
      return new URL(finalUrl).origin;
    } catch {
      return "";
    }
  })();

  for (const l of cleanedLinks) {
    try {
      (new URL(l).origin === origin ? internal : external).push(l);
    } catch {}
  }

  return {
    source: "website",
    url: finalUrl,
    title,
    description,
    content: text.slice(0, 5000), // Limit content length
    headings,
    features: features.slice(0, 10),
    services: services.slice(0, 10),
    links: {
      internal: internal.slice(0, 20),
      external: external.slice(0, 10),
    },
    scraped_at: new Date().toISOString(),
  };
}

/**
 * Scrapes a company website for content analysis
 * @param companyName - The company name to construct website URL
 * @returns Array of structured data for analysis
 */
export async function scrapeCompanyWebsite(
  companyName: string,
): Promise<any[]> {
  try {
    // Try to construct likely website URLs
    const companySlug = companyName.toLowerCase().replace(/\s+/g, "");
    const possibleUrls = [
      `https://www.${companySlug}.ai`,
      `https://www.${companySlug}.com`,
      `https://${companySlug}.com`,
      `https://www.${companySlug}.io`,
      `https://${companySlug}.io`,
    ];

    let result = null;
    let lastError = null;

    // Try each URL with retries
    for (const url of possibleUrls) {
      console.log(`Attempting to scrape: ${url}`);

      let attempt = 0;
      while (attempt <= RETRIES) {
        try {
          result = await scrapeWebsiteOnce(url);
          break;
        } catch (e) {
          lastError = e;
          attempt++;
          if (attempt <= RETRIES) {
            await new Promise((r) => setTimeout(r, 1000 * attempt));
          }
        }
      }

      if (result) {
        console.log(`Successfully scraped: ${url}`);
        const extractedData = extractWebsiteData(
          result.rawHtml,
          result.finalUrl,
        );
        return [extractedData];
      }
    }

    throw new Error(
      `Failed to scrape any website for ${companyName}. Last error: ${lastError?.message}`,
    );
  } catch (error) {
    console.error(`Error scraping website for ${companyName}:`, error);
    throw error;
  }
}
