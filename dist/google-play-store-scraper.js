"use strict";
// @ts-nocheck
/**
 * google-play-store-scraper.ts
 *
 * Targets the Google Play app id `app.linear`, opens the
 * "See more information on Ratings and reviews" modal,
 * scrapes reviews (or the full reviews page), and saves JSON + CSV.
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
const playwright_1 = require("playwright");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const APP_PKG = "app.linear";
const BASE_URL = `https://play.google.com/store/apps/details?id=${APP_PKG}&hl=en&gl=US`;
const OUTPUT_DIR = path.resolve(process.cwd(), "out");
const MAX_REVIEWS = 500;
const SCROLL_BATCHES = 60;
const SCROLL_STEP = 650;
const READMORE_CLICK_LIMIT = 250;
const HEADLESS = false;
const DEBUG_SLOWMO = 0;
const BUTTON_ARIA = "See more information on Ratings and reviews";
// ---------- tiny helpers ----------
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const waitTiny = (p, lo = 150, hi = 350) => p.waitForTimeout(rand(lo, hi));
const waitMed = (p, lo = 350, hi = 900) => p.waitForTimeout(rand(lo, hi));
function toCsvValue(v) {
    if (v == null)
        return "";
    const s = String(v).replace(/"/g, '""');
    return /[,"\n]/.test(s) ? `"${s}"` : s;
}
function saveCSV(filename, rows) {
    if (!rows.length)
        return;
    const headers = Object.keys(rows[0]);
    const lines = [headers.join(",")];
    for (const r of rows)
        lines.push(headers.map((h) => toCsvValue(r[h])).join(","));
    fs.writeFileSync(filename, lines.join("\n"), "utf-8");
}
// ---------- core: open modal by aria-label globally with progressive scroll ----------
function openRatingsInfoModal(page) {
    return __awaiter(this, void 0, void 0, function* () {
        // Load & give the SPA time to hydrate
        yield page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
        yield page
            .waitForLoadState("networkidle", { timeout: 15000 })
            .catch(() => { });
        yield waitMed(page);
        const btn = page.getByRole("button", { name: BUTTON_ARIA }).first();
        // Progressive scroll until button is attached & visible
        let found = false;
        for (let i = 0; i < 14; i++) {
            if (yield btn.count()) {
                try {
                    yield btn.scrollIntoViewIfNeeded();
                    if (yield btn.isVisible()) {
                        found = true;
                        break;
                    }
                }
                catch (_a) { }
            }
            yield page.mouse.wheel(0, rand(500, 900));
            yield waitTiny(page);
        }
        if (!found) {
            const anyBtn = page.locator(`button[aria-label="${BUTTON_ARIA}"]`).first();
            if (yield anyBtn.count()) {
                try {
                    yield anyBtn.scrollIntoViewIfNeeded();
                    if (yield anyBtn.isVisible()) {
                        yield anyBtn.click({ delay: rand(40, 120) });
                    }
                }
                catch (_b) { }
            }
            else {
                // Fallback: try an “All reviews” entry globally
                const seeAll = page
                    .locator('a:has-text("All reviews"), button:has-text("All reviews"), a:has-text("See all reviews"), button:has-text("See all reviews")')
                    .first();
                if (yield seeAll.count()) {
                    yield seeAll.scrollIntoViewIfNeeded().catch(() => { });
                    yield seeAll.click({ delay: 60 });
                    yield page.waitForLoadState("domcontentloaded");
                    return "page";
                }
                throw new Error("Could not find Ratings info button or All reviews entry.");
            }
        }
        else {
            yield btn.click({ delay: rand(40, 120) });
        }
        // Wait for modal
        const dialog = page.locator('div[role="dialog"]').first();
        try {
            yield dialog.waitFor({ state: "visible", timeout: 6000 });
            return "modal";
        }
        catch (_c) {
            return "page";
        }
    });
}
// ---------- scraping ----------
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!fs.existsSync(OUTPUT_DIR))
            fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        const browser = yield playwright_1.chromium.launch({
            headless: HEADLESS,
            slowMo: DEBUG_SLOWMO,
        });
        const context = yield browser.newContext({
            viewport: { width: 1366, height: 900 },
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            locale: "en-US",
        });
        const page = yield context.newPage();
        try {
            console.log("Visiting:", BASE_URL);
            yield page.goto(BASE_URL, {
                waitUntil: "domcontentloaded",
                timeout: 60000,
            });
            yield waitMed(page);
            const mode = yield openRatingsInfoModal(page);
            const dialog = page.locator('div[role="dialog"]').first();
            const root = mode === "modal" ? dialog : page.locator("body");
            if (mode === "modal") {
                yield dialog.waitFor({ state: "visible", timeout: 10000 });
                yield waitMed(page);
            }
            else {
                // Nudge the reviews list on the page
                for (let i = 0; i < 2; i++) {
                    yield page.mouse.wheel(0, rand(400, 800));
                    yield waitTiny(page);
                }
            }
            // Find a scrollable container within root
            const scrollableHandle = yield root.evaluateHandle((rootEl) => {
                function findScrollable(root) {
                    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
                    while (w.nextNode()) {
                        const el = w.currentNode;
                        const st = window.getComputedStyle(el);
                        if ((st.overflowY === "auto" || st.overflowY === "scroll") &&
                            el.scrollHeight > el.clientHeight &&
                            el.clientHeight > 0)
                            return el;
                    }
                    return root;
                }
                return findScrollable(rootEl);
            });
            // Get an ElementHandle and use elementHandle.evaluate so we can pass a single arg.
            const scrollEl = scrollableHandle.asElement();
            if (!scrollEl)
                throw new Error("Scrollable handle is not an element");
            function expandReadMores() {
                return __awaiter(this, arguments, void 0, function* (limit = READMORE_CLICK_LIMIT) {
                    let clicks = 0;
                    const buttons = root.locator('button:has-text("Full Review"), button:has-text("Read more"), div[role="button"]:has-text("Read more")');
                    const count = yield buttons.count();
                    for (let i = 0; i < count && clicks < limit; i++) {
                        const b = buttons.nth(i);
                        if (yield b.isVisible()) {
                            yield b.click({ delay: rand(20, 100) }).catch(() => { });
                            clicks++;
                            yield waitTiny(page, 120, 240);
                        }
                    }
                });
            }
            const seen = new Set();
            const reviews = [];
            for (let batch = 0; batch < SCROLL_BATCHES; batch++) {
                yield expandReadMores();
                const extracted = yield root.evaluate((rootEl) => {
                    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
                    const nodes = Array.from(rootEl.querySelectorAll(".RHo1pe"));
                    const parseIntFromText = (txt) => {
                        if (!txt)
                            return null;
                        const m = txt.replace(/,/g, "").match(/\d+/);
                        return m ? parseInt(m[0], 10) : null;
                    };
                    const getRatingFromLabel = (el) => {
                        if (!el)
                            return null;
                        const al = (el.getAttribute("aria-label") || "").trim();
                        const m = al.match(/Rated\s+(\d+)/i);
                        return m ? parseInt(m[1], 10) : null;
                    };
                    const pack = [];
                    for (const n of nodes) {
                        const header = n.querySelector("header[data-review-id]");
                        const review_id = (header === null || header === void 0 ? void 0 : header.getAttribute("data-review-id")) || null;
                        const author = ((_b = (_a = n.querySelector(".X5PpBb")) === null || _a === void 0 ? void 0 : _a.textContent) === null || _b === void 0 ? void 0 : _b.trim()) || null;
                        const date = ((_d = (_c = n.querySelector(".Jx4nYe .bp9Aid")) === null || _c === void 0 ? void 0 : _c.textContent) === null || _d === void 0 ? void 0 : _d.trim()) || null;
                        const ratingEl = n.querySelector('.Jx4nYe [aria-label^="Rated"]');
                        const rating = getRatingFromLabel(ratingEl);
                        const body = ((_f = (_e = n.querySelector(".h3YV2d")) === null || _e === void 0 ? void 0 : _e.textContent) === null || _f === void 0 ? void 0 : _f.trim()) || "";
                        const helpfulText = ((_h = (_g = n.querySelector(".AJTPZc")) === null || _g === void 0 ? void 0 : _g.textContent) === null || _h === void 0 ? void 0 : _h.trim()) || "";
                        const helpful_count = parseIntFromText(helpfulText) || 0;
                        const devBlock = ((_j = n.nextElementSibling) === null || _j === void 0 ? void 0 : _j.classList.contains("ocpBU"))
                            ? n.nextElementSibling
                            : n.querySelector(".ocpBU");
                        let developer_response_date = null;
                        let developer_response_text = null;
                        if (devBlock) {
                            developer_response_date =
                                ((_l = (_k = devBlock.querySelector(".I9Jtec")) === null || _k === void 0 ? void 0 : _k.textContent) === null || _l === void 0 ? void 0 : _l.trim()) || null;
                            developer_response_text =
                                ((_o = (_m = devBlock.querySelector(".ras4vb")) === null || _m === void 0 ? void 0 : _m.textContent) === null || _o === void 0 ? void 0 : _o.trim()) ||
                                    ((_q = (_p = devBlock.querySelector(".ras4vb div")) === null || _p === void 0 ? void 0 : _p.textContent) === null || _q === void 0 ? void 0 : _q.trim()) ||
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
                if (reviews.length >= MAX_REVIEWS)
                    break;
                // ✅ Use elementHandle.evaluate with a SINGLE argument (step)
                const step = rand(SCROLL_STEP - 120, SCROLL_STEP + 220);
                yield scrollEl.evaluate((el, s) => {
                    const node = el;
                    if (node && typeof node.scrollBy === "function") {
                        node.scrollBy({ top: s, behavior: "auto" });
                    }
                    else {
                        window.scrollBy({ top: s, behavior: "auto" });
                    }
                }, step);
                yield waitMed(page);
            }
            // Save
            const jsonPath = path.join(OUTPUT_DIR, `${APP_PKG}.reviews.json`);
            const csvPath = path.join(OUTPUT_DIR, `${APP_PKG}.reviews.csv`);
            fs.writeFileSync(jsonPath, JSON.stringify(reviews, null, 2), "utf-8");
            saveCSV(csvPath, reviews);
            console.log(`✅ Scraped ${reviews.length} reviews`);
            console.log(`→ JSON: ${jsonPath}`);
            console.log(`→ CSV : ${csvPath}`);
        }
        finally {
            yield context.close();
            yield browser.close();
        }
    });
}
run();
