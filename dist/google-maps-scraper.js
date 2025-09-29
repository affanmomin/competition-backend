"use strict";
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
exports.scrapeGoogleMapsData = scrapeGoogleMapsData;
//@ts-nocheck
const playwright_1 = require("playwright");
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const REVIEW_LIMIT = parseInt(process.env.REVIEW_LIMIT || "20", 10);
// Random pause
function pause(min = 500, max = 1500) {
    return new Promise((resolve) => setTimeout(resolve, Math.random() * (max - min) + min));
}
// Human-like typing
function typeSlow(page, selector, text) {
    return __awaiter(this, void 0, void 0, function* () {
        for (const char of text) {
            yield page.type(selector, char, { delay: 100 + Math.random() * 100 });
            yield pause(50, 150);
        }
    });
}
function scrapeGoogleMapsData(targetPlace) {
    return __awaiter(this, void 0, void 0, function* () {
        const browser = yield playwright_1.chromium.launch({ headless: false, slowMo: 50 });
        const context = yield browser.newContext({
            viewport: { width: 1280, height: 800 },
        });
        const page = yield context.newPage();
        try {
            console.log("🌍 Opening Google Maps...");
            yield page.goto("https://www.google.com/maps", {
                waitUntil: "domcontentloaded",
            });
            // Handle consent popup
            try {
                const consentBtn = page.locator("button:has-text('Accept all')");
                if (yield consentBtn.isVisible({ timeout: 5000 })) {
                    yield page.mouse.move(100, 100); // move mouse
                    yield pause(500, 1000);
                    yield consentBtn.click();
                    console.log("✅ Accepted consent popup");
                }
            }
            catch (_a) { }
            console.log(`🔎 Searching for: ${targetPlace}`);
            yield page.mouse.move(200, 200);
            yield pause(300, 600);
            yield typeSlow(page, "input#searchboxinput", targetPlace);
            yield pause(300, 600);
            yield page.press("input#searchboxinput", "Enter");
            // Click the first search result from the left sidebar
            try {
                console.log("⏳ Waiting for search results...");
                const firstResult = page
                    .locator('div[role="article"].Nv2PK:has(a.hfpxzc)')
                    .first();
                const firstAlt = page.locator('div[role="feed"] div.Nv2PK').first();
                yield Promise.race([
                    firstResult
                        .waitFor({ state: "visible", timeout: 20000 })
                        .catch(() => null),
                    firstAlt
                        .waitFor({ state: "visible", timeout: 20000 })
                        .catch(() => null),
                ]);
                if (yield firstResult.isVisible().catch(() => false)) {
                    yield pause(400, 800);
                    yield firstResult.click();
                    console.log("✅ Opened first search result (primary)");
                }
                else if (yield firstAlt.isVisible().catch(() => false)) {
                    yield pause(400, 800);
                    yield firstAlt.click();
                    console.log("✅ Opened first search result (fallback)");
                }
                else {
                    console.log("⚠️ No visible search result card; proceeding without explicit selection");
                }
                // Give time for place panel to load
                yield pause(1200, 1800);
            }
            catch (e) {
                console.log("⚠️ Could not click first result:", e.message);
            }
            console.log("⏳ Waiting for sidebar...");
            const reviewsBtn = page.locator('button:has(div.Gpq6kf.NlVald:has-text("Reviews"))');
            yield reviewsBtn.waitFor({ state: "visible", timeout: 20000 });
            console.log("📝 Clicking on Reviews...");
            yield page.mouse.move(300 + Math.random() * 50, 300 + Math.random() * 50);
            yield pause(500, 1000);
            yield reviewsBtn.click();
            yield pause(1500, 2500);
            // Robust scrollable container for reviews, with fallbacks
            let scrollable = page
                .locator('div[aria-label*="reviews"], div[aria-label*="Reviews"]')
                .filter({ has: page.locator("div.jftiEf") })
                .first();
            if (!(yield scrollable.isVisible().catch(() => false))) {
                scrollable = page
                    .locator("div.m6QErb.DxyBCb")
                    .filter({ has: page.locator("div.jftiEf") })
                    .first();
            }
            if (!(yield scrollable.isVisible().catch(() => false))) {
                const feed = page.getByRole("feed"); // e.g., Results feed if still on list
                if (yield feed.isVisible().catch(() => false)) {
                    scrollable = feed.first();
                }
            }
            yield scrollable.waitFor({ state: "visible", timeout: 20000 });
            console.log("⬇️ Scrolling and scraping reviews...");
            let reviews = [];
            let retries = 0;
            while (reviews.length < REVIEW_LIMIT && retries < 20) {
                // Scroll slowly in small steps
                for (let i = 0; i < 5; i++) {
                    yield scrollable.evaluate((el) => el.scrollBy(0, Math.floor(Math.random() * 100 + 50)));
                    yield pause(400, 800);
                }
                // Extract reviews incrementally
                const newReviews = yield page.$$eval("div.jftiEf", (cards) => cards.map((card) => {
                    var _a, _b, _c, _d;
                    const name = ((_a = card.querySelector(".d4r55")) === null || _a === void 0 ? void 0 : _a.innerText) || null;
                    const rating = ((_b = card.querySelector(".kvMYJc")) === null || _b === void 0 ? void 0 : _b.getAttribute("aria-label")) || null;
                    const text = ((_c = card.querySelector(".wiI7pd")) === null || _c === void 0 ? void 0 : _c.innerText) || null;
                    const date = ((_d = card.querySelector(".rsqaWe")) === null || _d === void 0 ? void 0 : _d.innerText) || null;
                    return { name, rating, text, date };
                }));
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
        }
        catch (err) {
            console.error("❌ Scrape failed:", err.message);
            throw err;
        }
        finally {
            yield browser.close();
        }
    });
}
// Allow running as standalone script
if (require.main === module) {
    const TARGET_PLACE = process.env.TARGET_PLACE || "titan";
    const OUTPUT_FILE = path.join(__dirname, "google_reviews.json");
    (() => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const reviews = yield scrapeGoogleMapsData(TARGET_PLACE);
            fs.writeFileSync(OUTPUT_FILE, JSON.stringify(reviews, null, 2), "utf-8");
            console.log(`💾 Saved to ${OUTPUT_FILE}`);
        }
        catch (error) {
            console.error("Script execution failed:", error);
            process.exit(1);
        }
    }))();
}
