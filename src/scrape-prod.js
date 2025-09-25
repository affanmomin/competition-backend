// scrape-prod.js
// Usage:
//   node scrape-prod.js https://www.linkedinflow.com --out out/lf --mode fast
// Modes:
//   fast  = no images/fonts/media, short idle wait (fastest, lowest bandwidth)
//   full  = allow same-origin css/xhr/script; images still blocked (balanced)
// Output: raw.html, clean.html, text.txt, summary.json

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const cheerio = require("cheerio");

const ARG_URL = process.argv[2];
if (!ARG_URL) {
  console.error(
    "Usage: node scrape-prod.js <url> [--out out/dir] [--mode fast|full]",
  );
  process.exit(1);
}
const getFlag = (k, def) => {
  const i = process.argv.indexOf(k);
  return i >= 0 ? process.argv[i + 1] : def;
};
const OUT_DIR = getFlag("--out", "out/site");
const MODE = (getFlag("--mode", "fast") || "fast").toLowerCase(); // fast|full

fs.mkdirSync(OUT_DIR, { recursive: true });

// ---- perf/robustness knobs ----
const NAV_TIMEOUT_MS = 25_000;
const IDLE_WAIT_MS = MODE === "fast" ? 800 : 1200; // keep small for prod latency
const MAX_SCROLLS = MODE === "fast" ? 4 : 8; // light lazy-load nudge w/o images
const RETRIES = 2; // total attempts = RETRIES + 1

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

function stripTracking(u) {
  try {
    const url = new URL(u);
    for (const p of TRACK_PARAMS) url.searchParams.delete(p);
    return url.toString();
  } catch {
    return u;
  }
}

function toAbs(base, href) {
  if (!href) return null;
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

function uniq(arr) {
  return [...new Set(arr.filter(Boolean))];
}

// Single O(n) cleaner
function cleanHtml(rawHtml, baseUrl) {
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

async function configureRouting(context, originHost) {
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

    // Stylesheets: allow same-origin only in "full" (for layout-dependent JS)
    if (resourceType === "stylesheet") {
      if (MODE === "full") {
        try {
          if (new URL(url).host === originHost) return route.continue();
        } catch {}
      }
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
  page,
  steps = MAX_SCROLLS,
  stepPx = 1000,
  pause = 150,
) {
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, stepPx);
    await page.waitForTimeout(pause);
  }
}

async function scrapeOnce(targetUrl) {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(targetUrl, { timeout: 60000 });

  let navRes = null;
  try {
    navRes = await page.goto(targetUrl, { timeout: 60000 });
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

(async () => {
  let attempt = 0,
    lastErr = null,
    result = null;
  while (attempt <= RETRIES) {
    try {
      result = await scrapeOnce("https://www.attherate.ai");
      break;
    } catch (e) {
      lastErr = e;
      attempt++;
      await new Promise((r) => setTimeout(r, 300 * attempt)); // linear backoff
    }
  }
  if (!result) {
    console.error("❌ Failed:", lastErr?.message || lastErr);
    process.exit(2);
  }

  const { rawHtml, finalUrl, status } = result;

  // Clean + extract — single pass each (O(n))
  const clean = cleanHtml(rawHtml, finalUrl);
  const $ = cheerio.load(clean);

  const title = ($("title").first().text() || "").trim() || null;
  const description =
    $('meta[name="description"]').attr("content") ||
    $('meta[property="og:description"]').attr("content") ||
    null;

  const bodyClone = $("body").clone();
  bodyClone.find("nav, header, footer, form, button, svg, style").remove();
  const text = bodyClone.text().replace(/\s+/g, " ").trim();

  const links = uniq(
    $("a[href]")
      .map((_, a) => $(a).attr("href"))
      .get(),
  );
  const cleanedLinks = links.map(stripTracking);

  const internal = [],
    external = [];
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

  fs.writeFileSync(path.join(OUT_DIR, "raw.html"), rawHtml, "utf-8");
  fs.writeFileSync(path.join(OUT_DIR, "clean.html"), clean, "utf-8");
  fs.writeFileSync(path.join(OUT_DIR, "text.txt"), text, "utf-8");
  fs.writeFileSync(
    path.join(OUT_DIR, "summary.json"),
    JSON.stringify(
      {
        scrapedAt: new Date().toISOString(),
        mode: MODE,
        targetUrl: ARG_URL,
        finalUrl,
        statusCode: status,
        title,
        description,
        linkStats: {
          total: cleanedLinks.length,
          internal: internal.length,
          external: external.length,
        },
        sampleInternalLinks: internal.slice(0, 50),
        sampleExternalLinks: external.slice(0, 50),
      },
      null,
      2,
    ),
    "utf-8",
  );

  console.log(`✅ Done (${MODE})
- ${path.join(OUT_DIR, "raw.html")}
- ${path.join(OUT_DIR, "clean.html")}
- ${path.join(OUT_DIR, "text.txt")}
- ${path.join(OUT_DIR, "summary.json")}`);
})();
