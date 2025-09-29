"use strict";
// @ts-nocheck
/**
 * google-business-scraper.ts
 * Scrapes Google Business profiles for company information, posts, and updates
 */
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
exports.scrapeGoogleBusinessPosts = scrapeGoogleBusinessPosts;
exports.scrapeGoogleBusinessData = scrapeGoogleBusinessData;
const playwright_1 = require("playwright");
const POSTS_LIMIT = parseInt(process.env.POSTS_LIMIT || "20", 10);
function pause(min = 1000, max = 2000) {
    return new Promise((resolve) => setTimeout(resolve, Math.random() * (max - min) + min));
}
/**
 * Scrapes Google Business profile posts and updates
 * @param businessName - The business name to search for
 * @returns Array of structured business posts and information
 */
function scrapeGoogleBusinessPosts(businessName) {
    return __awaiter(this, void 0, void 0, function* () {
        const browser = yield playwright_1.chromium.launch({ headless: true });
        const context = yield browser.newContext();
        const page = yield context.newPage();
        try {
            console.log(`🏢 Searching Google Business for: ${businessName}`);
            // Search for the business on Google
            yield page.goto("https://www.google.com/search", {
                waitUntil: "domcontentloaded",
            });
            // Handle consent popup if it appears
            try {
                const consentBtn = page.locator("button:has-text('Accept all')");
                if (yield consentBtn.isVisible({ timeout: 5000 })) {
                    yield consentBtn.click();
                    console.log("✅ Accepted consent popup");
                }
            }
            catch (_a) { }
            // Search for the business
            console.log(`🔎 Searching for business: ${businessName}`);
            yield page.fill("input[name='q']", `${businessName} business`);
            yield page.press("input[name='q']", "Enter");
            yield pause(2000, 3000);
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
                    if ((yield businessPanel.count()) > 0) {
                        break;
                    }
                }
                catch (_b) { }
            }
            if (!businessPanel || (yield businessPanel.count()) === 0) {
                // Try to find a Maps link to click
                const mapsLink = page.locator('a[href*="maps.google.com"]').first();
                if ((yield mapsLink.count()) > 0) {
                    console.log("📍 Navigating to Google Maps...");
                    yield mapsLink.click();
                    yield page.waitForLoadState("domcontentloaded");
                    yield pause(2000, 3000);
                }
                else {
                    throw new Error(`Could not find business panel or maps link for ${businessName}`);
                }
            }
            // Extract basic business information
            const businessInfo = yield page.evaluate(() => {
                const getTextBySelectors = (selectors) => {
                    var _a;
                    for (const selector of selectors) {
                        const el = document.querySelector(selector);
                        if (el)
                            return ((_a = el.textContent) === null || _a === void 0 ? void 0 : _a.trim()) || null;
                    }
                    return null;
                };
                const getAttributeBySelectors = (selectors, attribute) => {
                    for (const selector of selectors) {
                        const el = document.querySelector(selector);
                        if (el)
                            return el.getAttribute(attribute) || null;
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
                const website = getAttributeBySelectors(["a[data-attrid*='website']", "a[href*='http']"], "href");
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
            let posts = [];
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
                    if ((yield postsContainer.count()) > 0) {
                        console.log(`Found posts container with selector: ${selector}`);
                        // Extract posts from this container
                        const extractedPosts = yield postsContainer.evaluate((container) => {
                            var _a, _b;
                            const postElements = container.querySelectorAll("div, article, section");
                            const posts = [];
                            for (const el of postElements) {
                                const text = (_a = el.textContent) === null || _a === void 0 ? void 0 : _a.trim();
                                if (text && text.length > 20 && text.length < 1000) {
                                    // Try to extract date
                                    const dateEl = el.querySelector("[data-date], .date, time");
                                    const date = ((_b = dateEl === null || dateEl === void 0 ? void 0 : dateEl.textContent) === null || _b === void 0 ? void 0 : _b.trim()) ||
                                        (dateEl === null || dateEl === void 0 ? void 0 : dateEl.getAttribute("datetime")) ||
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
                }
                catch (e) {
                    console.log(`Failed with posts selector ${selector}:`, e.message);
                }
            }
            // If no posts found directly, try to extract any update-like content
            if (!postsFound) {
                console.log("📰 Looking for general business updates...");
                const updates = yield page.evaluate(() => {
                    var _a;
                    const textElements = document.querySelectorAll("p, div, span");
                    const updates = [];
                    for (const el of textElements) {
                        const text = ((_a = el.textContent) === null || _a === void 0 ? void 0 : _a.trim()) || "";
                        // Look for content that might be business updates
                        if (text.length > 50 &&
                            text.length < 800 &&
                            (text.includes("update") ||
                                text.includes("new") ||
                                text.includes("announce") ||
                                text.includes("offer") ||
                                text.includes("service") ||
                                text.includes("product"))) {
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
            const businessData = Object.assign(Object.assign({}, businessInfo), { source: "google_business", type: "business_info", scraped_at: new Date().toISOString(), posts_count: posts.length });
            result.push(businessData);
            // Add posts with timestamp
            posts.forEach((post) => {
                result.push(Object.assign(Object.assign({}, post), { business_name: businessName, scraped_at: new Date().toISOString() }));
            });
            console.log(`✅ Scraped ${result.length} items for ${businessName} from Google Business`);
            return result;
        }
        catch (error) {
            console.error(`❌ Google Business scrape failed for ${businessName}:`, error.message);
            throw error;
        }
        finally {
            yield browser.close();
        }
    });
}
/**
 * Main function to scrape Google Business data
 * @param businessName - The business name to search for
 * @returns Array of business information and posts
 */
function scrapeGoogleBusinessData(businessName) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            return yield scrapeGoogleBusinessPosts(businessName);
        }
        catch (error) {
            console.error(`Error scraping Google Business data for ${businessName}:`, error);
            throw error;
        }
    });
}
