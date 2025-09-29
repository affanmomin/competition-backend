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
//@ts-nocheck
const playwright_1 = require("playwright");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const TARGET_PLACE = process.env.TARGET_PLACE || "Googleplex";
const REVIEW_LIMIT = parseInt(process.env.REVIEW_LIMIT || "20", 10);
const OUTPUT_FILE = path.join(__dirname, "google_reviews.json");
function pause(min = 1000, max = 2000) {
    return new Promise((resolve) => setTimeout(resolve, Math.random() * (max - min) + min));
}
(() => __awaiter(void 0, void 0, void 0, function* () {
    const browser = yield playwright_1.chromium.launch({ headless: false });
    const context = yield browser.newContext();
    const page = yield context.newPage();
    try {
        console.log("🌍 Opening Google Maps...");
        yield page.goto("https://www.google.com/maps", {
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
        console.log(`🔎 Searching for: ${TARGET_PLACE}`);
        yield page.fill("input#searchboxinput", TARGET_PLACE);
        yield page.press("input#searchboxinput", "Enter");
        console.log("⏳ Waiting for sidebar to load...");
        const reviewsBtn = page.locator('button:has(div.Gpq6kf.NlVald:has-text("Reviews"))');
        yield reviewsBtn.waitFor({ state: "visible", timeout: 20000 });
        console.log("📝 Clicking on Reviews...");
        yield reviewsBtn.click();
        yield pause(1500, 2500);
        // Locate scrollable reviews container
        const scrollable = page.locator("div.m6QErb.DxyBCb.kA9KIf.dS8AEf"); // most robust currently
        yield scrollable.waitFor({ state: "visible", timeout: 15000 });
        console.log("⬇️ Scrolling and scraping reviews...");
        let reviews = [];
        let retries = 0;
        while (reviews.length < REVIEW_LIMIT && retries < 15) {
            // Scroll down
            yield scrollable.evaluate((el) => el.scrollBy(0, el.scrollHeight));
            yield pause(1500, 2500);
            // Extract reviews incrementally
            const newReviews = yield page.$$eval("div.jftiEf", (cards) => cards.map((card) => {
                var _a, _b, _c, _d;
                const name = ((_a = card.querySelector(".d4r55")) === null || _a === void 0 ? void 0 : _a.innerText) || null;
                const rating = ((_b = card.querySelector(".kvMYJc")) === null || _b === void 0 ? void 0 : _b.getAttribute("aria-label")) || null;
                const text = ((_c = card.querySelector(".wiI7pd")) === null || _c === void 0 ? void 0 : _c.innerText) || null;
                const date = ((_d = card.querySelector(".rsqaWe")) === null || _d === void 0 ? void 0 : _d.innerText) || null;
                return { name, rating, text, date };
            }));
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
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(reviews.slice(0, REVIEW_LIMIT), null, 2), "utf-8");
        console.log(`💾 Saved to ${OUTPUT_FILE}`);
    }
    catch (err) {
        console.error("❌ Scrape failed:", err.message);
    }
    finally {
        yield browser.close();
    }
}))();
