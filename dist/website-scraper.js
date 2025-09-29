"use strict";
// @ts-nocheck
/**
 * website-scraper.ts
 * Scrapes company websites for content analysis
 * Converts scrape-prod.js into a reusable function
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapeCompanyWebsite = scrapeCompanyWebsite;
const playwright_1 = require("playwright");
const cheerio = __importStar(require("cheerio"));
const NAV_TIMEOUT_MS = 25000;
const IDLE_WAIT_MS = 1200;
const MAX_SCROLLS = 4;
const RETRIES = 2;
// Common trackers/CDNs to block (regex)
const BLOCK_RE = new RegExp([
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
].join("|"), "i");
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
        for (const p of TRACK_PARAMS)
            url.searchParams.delete(p);
        return url.toString();
    }
    catch (_a) {
        return u;
    }
}
function toAbs(base, href) {
    if (!href)
        return null;
    try {
        return new URL(href, base).toString();
    }
    catch (_a) {
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
        if (this.type === "comment")
            $(this).remove();
    });
    // Normalize links + images; strip inline handlers
    $("*").each((_, el) => {
        const attribs = el.attribs || {};
        for (const name of Object.keys(attribs)) {
            const low = name.toLowerCase();
            if (low.startsWith("on"))
                $(el).removeAttr(name); // onclick, etc.
            if (low === "aria-hidden" || low.startsWith("data-test"))
                $(el).removeAttr(name);
        }
    });
    $("a[href]").each((_, a) => {
        const abs = toAbs(baseUrl, $(a).attr("href"));
        if (abs)
            $(a).attr("href", stripTracking(abs));
    });
    $("img[src], img[data-src]").each((_, img) => {
        const src = $(img).attr("src") || $(img).attr("data-src");
        const abs = toAbs(baseUrl, src);
        if (abs)
            $(img).attr("src", abs);
        $(img).removeAttr("srcset"); // smaller output
    });
    // Basic minify
    return $.html()
        .replace(/\s+\n/g, "\n")
        .replace(/\n{2,}/g, "\n")
        .replace(/[ \t]{2,}/g, " ");
}
function configureRouting(context, originHost) {
    return __awaiter(this, void 0, void 0, function* () {
        yield context.route("**/*", (route) => {
            const req = route.request();
            const url = req.url();
            const resourceType = req.resourceType();
            // Always block known trackers
            if (BLOCK_RE.test(url))
                return route.abort();
            // Block heavy types (always)
            if (["media", "font"].includes(resourceType))
                return route.abort();
            // Images are the heaviest — block in all modes (we only need DOM/text)
            if (resourceType === "image")
                return route.abort();
            // Stylesheets: allow same-origin only
            if (resourceType === "stylesheet") {
                try {
                    if (new URL(url).host === originHost)
                        return route.continue();
                }
                catch (_a) { }
                return route.abort();
            }
            // XHR/Fetch/Script: allow same-origin; block 3P
            if (["xhr", "fetch", "script"].includes(resourceType)) {
                try {
                    if (new URL(url).host === originHost)
                        return route.continue();
                }
                catch (_b) { }
                return route.abort();
            }
            // Document/navigation: allow
            return route.continue();
        });
    });
}
function lazyNudge(page_1) {
    return __awaiter(this, arguments, void 0, function* (page, steps = MAX_SCROLLS, stepPx = 1000, pause = 150) {
        for (let i = 0; i < steps; i++) {
            yield page.mouse.wheel(0, stepPx);
            yield page.waitForTimeout(pause);
        }
    });
}
function scrapeWebsiteOnce(targetUrl) {
    return __awaiter(this, void 0, void 0, function* () {
        const browser = yield playwright_1.chromium.launch({ headless: true });
        const context = yield browser.newContext();
        const page = yield context.newPage();
        let navRes = null;
        try {
            navRes = yield page.goto(targetUrl, { timeout: NAV_TIMEOUT_MS });
        }
        catch (e) {
            yield context.close();
            yield browser.close();
            throw new Error(`Navigation error: ${e.message}`);
        }
        const finalUrl = page.url();
        const originHost = (() => {
            try {
                return new URL(finalUrl).host;
            }
            catch (_a) {
                return "";
            }
        })();
        // Now attach strict routing optimized for the final origin
        yield context.unroute("**/*");
        yield configureRouting(context, originHost);
        // Light lazy-load nudge (images blocked => low bandwidth)
        yield lazyNudge(page);
        yield page
            .waitForLoadState("networkidle", { timeout: IDLE_WAIT_MS })
            .catch(() => { });
        // Serialize the *current* DOM (post-scripts)
        const rawHtml = yield page.evaluate(() => document.documentElement.outerHTML);
        const status = navRes ? navRes.status() : null;
        yield context.close();
        yield browser.close();
        return { rawHtml, finalUrl, status };
    });
}
function extractWebsiteData(rawHtml, finalUrl) {
    const clean = cleanHtml(rawHtml, finalUrl);
    const $ = cheerio.load(clean);
    const title = ($("title").first().text() || "").trim() || null;
    const description = $('meta[name="description"]').attr("content") ||
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
    $("*:contains('feature'), *:contains('benefit'), *:contains('advantage')").each((_, el) => {
        const text = $(el).text().trim();
        if (text.length > 10 && text.length < 200) {
            features.push(text);
        }
    });
    // Look for service-related sections
    $("*:contains('service'), *:contains('solution'), *:contains('product')").each((_, el) => {
        const text = $(el).text().trim();
        if (text.length > 10 && text.length < 200) {
            services.push(text);
        }
    });
    const links = uniq($("a[href]")
        .map((_, a) => $(a).attr("href"))
        .get());
    const cleanedLinks = links.map(stripTracking);
    const internal = [];
    const external = [];
    const origin = (() => {
        try {
            return new URL(finalUrl).origin;
        }
        catch (_a) {
            return "";
        }
    })();
    for (const l of cleanedLinks) {
        try {
            (new URL(l).origin === origin ? internal : external).push(l);
        }
        catch (_a) { }
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
function scrapeCompanyWebsite(companyName) {
    return __awaiter(this, void 0, void 0, function* () {
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
                        result = yield scrapeWebsiteOnce(url);
                        break;
                    }
                    catch (e) {
                        lastError = e;
                        attempt++;
                        if (attempt <= RETRIES) {
                            yield new Promise((r) => setTimeout(r, 1000 * attempt));
                        }
                    }
                }
                if (result) {
                    console.log(`Successfully scraped: ${url}`);
                    const extractedData = extractWebsiteData(result.rawHtml, result.finalUrl);
                    return [extractedData];
                }
            }
            throw new Error(`Failed to scrape any website for ${companyName}. Last error: ${lastError === null || lastError === void 0 ? void 0 : lastError.message}`);
        }
        catch (error) {
            console.error(`Error scraping website for ${companyName}:`, error);
            throw error;
        }
    });
}
