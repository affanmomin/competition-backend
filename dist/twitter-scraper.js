"use strict";
// @ts-nocheck
/**
 * twitter-scraper.ts
 * Scrapes Twitter profile posts + comments with human-like behaviour.
 * Usage: npx tsx src/twitter-scraper.ts
 * IMPORTANT: Respect Twitter's Terms of Service.
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
exports.HUMAN_PROFILE = void 0;
exports.scrapeTwitterPosts = scrapeTwitterPosts;
const playwright_1 = require("playwright");
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const format_1 = require("@fast-csv/format");
// ----------------- CONFIG -----------------
const TWITTER_USER = process.env.TWITTER_USER || "chanda_adn50636";
const TWITTER_PASS = process.env.TWITTER_PASS || "Dev@1234";
const loginUrl = "https://twitter.com/login";
const DEBUG = true;
const INCLUDE_COMMENTS = true;
const MAX_COMMENT_PAGES = 5; // how many times to scroll to load more comments
const MAX_COMMENTS_PER_POST = 50; // hard cap per post
const TWEET_LIMIT = 5; // number of tweets to scrape
const PARALLEL_LIMIT = 2; // number of tweet pages to scrape in parallel
const STORAGE_STATE_PATH = path.resolve(process.cwd(), "twitter-session.json"); // <- session file
// ----------------- Per-run Human Profile (8) -----------------
exports.HUMAN_PROFILE = {
    // Multiplier for dwell/pauses and general tempo
    paceMultiplier: 0.85 + Math.random() * 0.7, // 0.85x–1.55x
    // Typing style variance
    typoRate: 0.05 + Math.random() * 0.06, // 5–11%
    // Mouse hover tendency
    hoveriness: Math.random(), // 0–1
    // Scroll aggressiveness
    scrollAggro: Math.random(), // 0–1
};
// ----------------- Derived file names -----------------
function generateTwitterNames(profileHandle) {
    const profile_slug = profileHandle.replace("@", "").toLowerCase();
    const profileNameTitle = profile_slug.replace(/\b\w/g, (c) => c.toUpperCase());
    return {
        profile_slug,
        profileNameTitle,
        profileUrl: `https://twitter.com/${profile_slug}`,
    };
}
// ----------------- Selectors -----------------
const SEL_USER = 'input[name="text"]';
const SEL_PASS = 'input[name="password"]';
// Tweet selectors
const SEL_TWEET_CONTAINER = 'article[role="article"], article[data-testid="tweet"]';
const SEL_TWEET_TEXT = "div[lang]";
const SEL_TWEET_LINK = 'a[href*="/status/"]';
const SEL_TWEET_TIME = "time";
// Engagement selectors
const SEL_LIKE_BUTTON = 'div[data-testid="like"]';
const SEL_RETWEET_BUTTON = 'div[data-testid="retweet"]';
const SEL_REPLY_BUTTON = 'div[data-testid="reply"]';
// Comment/Reply selectors
const SEL_USERNAME = 'div[data-testid="User-Name"] span';
// ----------------- Human-like utilities -----------------
function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pause() {
    return __awaiter(this, arguments, void 0, function* (min = 140, max = 320) {
        // Apply human pace multiplier
        const k = exports.HUMAN_PROFILE.paceMultiplier;
        const adjMin = Math.max(1, Math.floor(min * k));
        const adjMax = Math.max(adjMin + 1, Math.floor(max * k));
        yield new Promise((r) => setTimeout(r, rand(adjMin, adjMax)));
    });
}
function bezier(p0, p1, p2, p3, t) {
    const u = 1 - t, tt = t * t, uu = u * u, uuu = uu * u, ttt = tt * t;
    return {
        x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
        y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
    };
}
function humanMove(page, toX, toY) {
    return __awaiter(this, void 0, void 0, function* () {
        const vp = page.viewportSize();
        const from = {
            x: Math.floor(((vp === null || vp === void 0 ? void 0 : vp.width) || 1280) * (0.45 + Math.random() * 0.1)),
            y: Math.floor(((vp === null || vp === void 0 ? void 0 : vp.height) || 720) * (0.45 + Math.random() * 0.1)),
        };
        const p1 = { x: from.x + rand(-60, 60), y: from.y + rand(-40, 40) };
        const p2 = { x: toX + rand(-80, 80), y: toY + rand(-40, 40) };
        const p3 = { x: toX, y: toY };
        const steps = Math.floor(Math.random() * 18) + 12;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const p = bezier(from, p1, p2, p3, t);
            yield page.mouse.move(p.x, p.y, { steps: 1 });
            yield pause(4, 14);
        }
    });
}
function humanHover(page, selector) {
    return __awaiter(this, void 0, void 0, function* () {
        const el = yield page.waitForSelector(selector, { timeout: 12000 });
        const box = yield (el === null || el === void 0 ? void 0 : el.boundingBox());
        if (!box)
            return;
        const x = box.x + box.width * (0.3 + Math.random() * 0.4);
        const y = box.y + box.height * (0.3 + Math.random() * 0.4);
        yield humanMove(page, x, y);
        yield pause(200, 600);
    });
}
function humanClick(page, selector) {
    return __awaiter(this, void 0, void 0, function* () {
        const el = yield page.waitForSelector(selector, { timeout: 15000 });
        const box = yield (el === null || el === void 0 ? void 0 : el.boundingBox());
        if (!box)
            return;
        const x = box.x + box.width * (0.35 + Math.random() * 0.3);
        const y = box.y + box.height * (0.35 + Math.random() * 0.3);
        yield humanMove(page, x, y);
        yield pause(90, 220);
        yield page.mouse.down();
        yield pause(40, 120);
        yield page.mouse.up();
        yield pause(160, 420);
    });
}
// ----------------- (2) Human wheel scrolling -----------------
function humanWheelScroll(page_1) {
    return __awaiter(this, arguments, void 0, function* (page, range = [3, 6]) {
        const reps = rand(range[0], range[1]);
        for (let i = 0; i < reps; i++) {
            // base delta depends on viewport and scrollAggro
            const deltaBase = Math.floor((yield page.evaluate(() => window.innerHeight)) *
                (0.45 + exports.HUMAN_PROFILE.scrollAggro * 0.6));
            const direction = Math.random() < 0.18 ? -1 : 1; // sometimes scroll up
            yield page.mouse.wheel(0, direction * deltaBase);
            yield pause(200, 500);
            if (Math.random() < 0.35)
                yield page.mouse.wheel(0, rand(-60, 60)); // jitter
            yield pause(400, 1200); // "reading" dwell
        }
    });
}
// ----------------- (4) Typing with imperfections -----------------
function humanType(page, selector, text) {
    return __awaiter(this, void 0, void 0, function* () {
        const loc = page.locator(selector);
        yield loc.click({ timeout: 15000 });
        const chars = text.split("");
        for (const ch of chars) {
            // typo?
            if (/[a-z]/i.test(ch) && Math.random() < exports.HUMAN_PROFILE.typoRate) {
                const typo = String.fromCharCode(ch.charCodeAt(0) + (Math.random() < 0.5 ? 1 : -1));
                yield page.keyboard.type(typo, { delay: rand(50, 120) });
                yield pause(60, 140);
                yield page.keyboard.press("Backspace");
                yield pause(40, 110);
            }
            yield page.keyboard.type(ch, {
                delay: rand(60, 150) * exports.HUMAN_PROFILE.paceMultiplier,
            });
            if (Math.random() < 0.06)
                yield pause(100, 260); // hesitation
        }
    });
}
// ----------------- Stealth context (supports storageState reuse) -----------------
function makeStealthyContext(browser, storageStatePath) {
    return __awaiter(this, void 0, void 0, function* () {
        const contextOpts = {
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            viewport: { width: 1280, height: 720 },
        };
        if (storageStatePath && fs.existsSync(storageStatePath)) {
            contextOpts.storageState = storageStatePath;
            if (DEBUG)
                console.log("Using saved storageState:", storageStatePath);
        }
        const context = yield browser.newContext(contextOpts);
        // Block unnecessary resources + (10) gentle jitter
        yield context.route("**/*", (route) => __awaiter(this, void 0, void 0, function* () {
            const type = route.request().resourceType();
            if (["font", "media"].includes(type))
                return route.abort();
            // 7% of requests get a tiny random delay to mimic home Wi-Fi wobble
            if (Math.random() < 0.07) {
                yield pause(60, 220);
            }
            return route.continue();
        }));
        return context;
    });
}
// ----------------- Session management -----------------
function saveSession(context) {
    return __awaiter(this, void 0, void 0, function* () {
        const page = yield context.newPage();
        yield page.goto("https://twitter.com", { waitUntil: "load" });
        const cookies = yield context.cookies();
        const localStorage = yield page.evaluate(() => {
            const store = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key)
                    store[key] = localStorage.getItem(key) || "";
            }
            return store;
        });
        fs.writeFileSync(STORAGE_STATE_PATH, JSON.stringify({ cookies, localStorage }, null, 2));
        yield page.close();
        console.log("💾 Session saved");
    });
}
function loadSession(context) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!fs.existsSync(STORAGE_STATE_PATH))
            return false;
        try {
            const sessionData = JSON.parse(fs.readFileSync(STORAGE_STATE_PATH, "utf-8"));
            yield context.addCookies(sessionData.cookies);
            const page = yield context.newPage();
            yield page.goto("https://twitter.com", { waitUntil: "domcontentloaded" });
            yield page.evaluate((data) => {
                for (const key in data) {
                    localStorage.setItem(key, data[key]);
                }
            }, sessionData.localStorage);
            yield page.close();
            console.log("🔁 Session loaded");
            return true;
        }
        catch (err) {
            console.warn("⚠️ Could not load session:", err.message);
            return false;
        }
    });
}
// ----------------- Login function -----------------
function login(page) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log("🔐 Logging in...");
            yield page.goto(loginUrl, {
                waitUntil: "domcontentloaded",
                timeout: 60000,
            });
            yield page.waitForSelector(SEL_USER, { timeout: 20000 });
            yield pause(200, 400);
            // (1 + 4) Hover + slow click + human typing for username
            if (exports.HUMAN_PROFILE.hoveriness > 0.3)
                yield humanHover(page, SEL_USER);
            yield humanClick(page, SEL_USER);
            yield humanType(page, SEL_USER, TWITTER_USER);
            yield pause(160, 260);
            yield page.keyboard.press("Enter");
            yield page.waitForSelector(SEL_PASS, { timeout: 15000 });
            yield pause(240, 460);
            if (exports.HUMAN_PROFILE.hoveriness > 0.4)
                yield humanHover(page, SEL_PASS);
            yield humanClick(page, SEL_PASS);
            yield humanType(page, SEL_PASS, TWITTER_PASS);
            yield pause(160, 300);
            yield page.keyboard.press("Enter");
            yield Promise.race([
                page.waitForSelector('input[aria-label="Search query"]', {
                    timeout: 30000,
                }),
                page.waitForURL("**/home", { timeout: 30000 }),
            ]);
            console.log("✅ Logged in successfully");
        }
        catch (error) {
            throw new Error(`Login failed: ${error.message}`);
        }
    });
}
// ----------------- Engagement parsing utilities -----------------
function extractDigits(text) {
    if (!text)
        return "0";
    const t = text.replace(/\u00A0/g, " ").trim();
    const mMatch = t.match(/(\d+(?:\.\d+)?)\s*[Mm]/);
    const kMatch = t.match(/(\d+(?:\.\d+)?)\s*[Kk]/);
    if (mMatch)
        return String(Math.round(parseFloat(mMatch[1]) * 1000000));
    if (kMatch)
        return String(Math.round(parseFloat(kMatch[1]) * 1000));
    const plain = t.match(/[\d,.]+/);
    return plain ? plain[0].replace(/[.,](?=\d{3}\b)/g, "") : "0";
}
function convertAbbreviatedToNumber(s) {
    if (!s)
        return 0;
    const numPart = (s.match(/[\d,.]+(?:\s*[KM])?/i) || [""])[0].replace(/[,\u00A0]/g, "");
    const up = numPart.toUpperCase();
    if (up.endsWith("K"))
        return Math.round(parseFloat(up) * 1000);
    if (up.endsWith("M"))
        return Math.round(parseFloat(up) * 1000000);
    const n = parseInt(numPart, 10);
    return Number.isFinite(n) ? n : 0;
}
// ----------------- Tweet collection functions -----------------
function collectTweetUrls(page, limit) {
    return __awaiter(this, void 0, void 0, function* () {
        const tweets = [];
        const seen = new Set();
        let scrollAttempts = 0;
        while (tweets.length < limit && scrollAttempts < 6) {
            const articles = yield page.$$(SEL_TWEET_CONTAINER);
            yield Promise.all(articles.map((article) => __awaiter(this, void 0, void 0, function* () {
                if (tweets.length >= limit)
                    return;
                try {
                    const anchor = yield article.$(SEL_TWEET_LINK);
                    if (!anchor)
                        return;
                    let href = yield anchor.getAttribute("href");
                    if (!href || seen.has(href))
                        return;
                    if (!href.startsWith("http"))
                        href = new URL(href, "https://twitter.com").href;
                    seen.add(href);
                    let likes = "0";
                    try {
                        const likeAction = yield article.$(SEL_LIKE_BUTTON);
                        if (likeAction) {
                            const countText = yield likeAction.evaluate((node) => {
                                const group = node.closest('div[role="group"]') || node.parentElement;
                                if (group) {
                                    const candidates = group.querySelectorAll("span, div");
                                    for (const c of candidates) {
                                        const txt = (c.textContent || "").trim();
                                        if (/^\d[\d,.\sKkMm]*$/.test(txt))
                                            return txt;
                                    }
                                }
                                return node.getAttribute("aria-label") || "";
                            });
                            likes = extractDigits(countText || "");
                        }
                    }
                    catch (_a) { }
                    tweets.push({ url: href, likes });
                }
                catch (_b) { }
            })));
            if (tweets.length < limit) {
                // (2) replace old scroll with wheel-based human scroll
                yield humanWheelScroll(page, [2, 4]);
                scrollAttempts++;
            }
        }
        return tweets.slice(0, limit);
    });
}
// ----------------- Tweet page scraping -----------------
function scrapeTweetPage(context, tweetObj, index) {
    return __awaiter(this, void 0, void 0, function* () {
        const page = yield context.newPage();
        try {
            yield page.goto(tweetObj.url, { timeout: 25000 });
            yield pause(180, 360);
            let mainTweet = "Could not load tweet";
            try {
                yield page.waitForSelector('article[data-testid="tweet"] div[lang], article[role="article"] div[lang]', { timeout: 8000 });
                mainTweet = yield page.$eval('article[data-testid="tweet"] div[lang], article[role="article"] div[lang]', (el) => el.innerText.trim());
            }
            catch (_a) { }
            const commentMap = new Map();
            let scrollCount = 0;
            let noNewCount = 0;
            while (commentMap.size < MAX_COMMENTS_PER_POST &&
                scrollCount < MAX_COMMENT_PAGES &&
                noNewCount < 2) {
                const before = commentMap.size;
                const articles = yield page.$$('article[data-testid="tweet"], article[role="article"]');
                for (let i = 1; i < Math.min(articles.length, 40); i++) {
                    try {
                        const username = yield articles[i]
                            .$eval('div[data-testid="User-Name"] span', (el) => el.innerText.trim())
                            .catch(() => "");
                        const commentText = yield articles[i]
                            .$eval("div[lang]", (el) => el.innerText.trim())
                            .catch(() => "");
                        if (commentText) {
                            const key = username + "|" + commentText;
                            if (!commentMap.has(key))
                                commentMap.set(key, { username, comment: commentText });
                        }
                    }
                    catch (_b) { }
                }
                if (commentMap.size === before)
                    noNewCount++;
                else
                    noNewCount = 0;
                if (commentMap.size < MAX_COMMENTS_PER_POST &&
                    scrollCount < MAX_COMMENT_PAGES) {
                    // (2) wheel-based scroll instead of evaluate-scroll
                    yield humanWheelScroll(page, [3, 5]);
                    yield pause(260, 520);
                    scrollCount++;
                }
            }
            return {
                url: tweetObj.url,
                text: mainTweet.trim(),
                dateRaw: "",
                dateISO: new Date().toISOString().split("T")[0],
                likesRaw: tweetObj.likes,
                likesNumeric: convertAbbreviatedToNumber(tweetObj.likes),
                commentsRaw: String(commentMap.size),
                commentsNumeric: commentMap.size,
                sharesRaw: "0",
                sharesNumeric: 0,
                mediaType: "Unknown",
                mediaLink: "",
                comments: Array.from(commentMap.values()).slice(0, MAX_COMMENTS_PER_POST),
            };
        }
        catch (error) {
            return {
                url: tweetObj.url,
                text: "Error loading tweet",
                dateRaw: "",
                dateISO: new Date().toISOString().split("T")[0],
                likesRaw: tweetObj.likes,
                likesNumeric: convertAbbreviatedToNumber(tweetObj.likes),
                commentsRaw: "0",
                commentsNumeric: 0,
                sharesRaw: "0",
                sharesNumeric: 0,
                mediaType: "Unknown",
                mediaLink: "",
                comments: [],
            };
        }
        finally {
            yield page.close();
        }
    });
}
// ----------------- CSV / JSON export -----------------
function exportCsv(filePath, rows) {
    return __awaiter(this, void 0, void 0, function* () {
        yield fs.ensureFile(filePath);
        const stream = fs.createWriteStream(filePath);
        const csv = (0, format_1.format)({ headers: true });
        csv.pipe(stream);
        rows.forEach((r) => csv.write(r));
        csv.end();
    });
}
// ----------------- Main Scraping Function -----------------
function scrapeTwitterPosts(profileHandle) {
    return __awaiter(this, void 0, void 0, function* () {
        const { profileUrl, profileNameTitle } = generateTwitterNames(profileHandle);
        const browser = yield playwright_1.chromium.launch({
            headless: false,
            slowMo: 50,
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-blink-features=AutomationControlled",
            ],
            proxy: {
                server: "http://gw.dataimpulse.com:823",
                username: "2cef711aaa1a060b00b2",
                password: "71e56626760e1077",
            },
        });
        const context = yield makeStealthyContext(browser, fs.existsSync(STORAGE_STATE_PATH) ? STORAGE_STATE_PATH : undefined);
        try {
            let sessionLoaded = yield loadSession(context);
            const page = yield context.newPage();
            if (sessionLoaded) {
                try {
                    yield page.goto("https://twitter.com/home", {
                        waitUntil: "domcontentloaded",
                        timeout: 20000,
                    });
                    const currentURL = page.url();
                    if (currentURL.includes("/login")) {
                        console.log("❌ Session invalid. Re-authenticating...");
                        sessionLoaded = false;
                    }
                    else {
                        console.log("✅ Session valid. Skipping login.");
                    }
                }
                catch (_a) {
                    console.log("⚠️ Session validation failed. Re-authenticating...");
                    sessionLoaded = false;
                }
            }
            if (!sessionLoaded) {
                yield login(page);
                yield saveSession(context);
            }
            // Navigate to profile (1) hover the avatar/profile link sometimes
            yield page.goto(profileUrl, { timeout: 25000 });
            if (exports.HUMAN_PROFILE.hoveriness > 0.5) {
                yield humanHover(page, 'a[href*="/photo"]');
            }
            yield page.waitForSelector('article[role="article"], article[data-testid="tweet"]', { timeout: 15000 });
            // Collect tweet URLs
            const tweetObjs = yield collectTweetUrls(page, TWEET_LIMIT);
            const results = [];
            // Scrape tweets in parallel batches
            for (let i = 0; i < tweetObjs.length; i += PARALLEL_LIMIT) {
                const batch = tweetObjs.slice(i, i + PARALLEL_LIMIT);
                const batchResults = yield Promise.all(batch.map((t, j) => scrapeTweetPage(context, t, i + j + 1)));
                results.push(...batchResults);
                if (i + PARALLEL_LIMIT < tweetObjs.length)
                    yield pause(800, 1200);
            }
            return results;
        }
        catch (error) {
            console.error("❌ Twitter scraping failed:", error.message);
            throw error;
        }
        finally {
            try {
                yield context.close();
            }
            catch (_b) { }
            try {
                yield browser.close();
            }
            catch (_c) { }
        }
    });
}
// ----------------- Legacy Main Function (for backwards compatibility) -----------------
function run(company) {
    return __awaiter(this, void 0, void 0, function* () {
        const profileHandle = company; // Default profile for legacy usage
        try {
            const results = yield scrapeTwitterPosts(profileHandle);
            // Export results - match original output format
            const dataDir = path.join(process.cwd(), "data");
            if (!fs.existsSync(dataDir))
                fs.mkdirSync(dataDir, { recursive: true });
            fs.writeFileSync(path.join(dataDir, "tweets_with_comments.json"), JSON.stringify(results, null, 2));
            console.log(`✅ Saved to data/tweets_with_comments.json`);
        }
        catch (error) {
            console.error("❌ SCRIPT FAILED:", error);
            throw error;
        }
    });
}
// Run if called directly
if (require.main === module) {
    run("Tesla").catch((err) => {
        console.error(err);
        process.exit(1);
    });
}
