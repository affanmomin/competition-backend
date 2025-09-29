"use strict";
// @ts-nocheck
/**
 * linkedin-scraper-stealth.ts
 * Scrapes LinkedIn company posts + comments with human-like behaviour.
 * Usage: npx tsx src/linkedin-scraper-stealth.ts
 * IMPORTANT: Respect LinkedIn's Terms of Service.
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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapeCompanyPosts = scrapeCompanyPosts;
const playwright_1 = require("playwright");
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const format_1 = require("@fast-csv/format");
const date_fns_1 = require("date-fns");
// ----------------- CONFIG -----------------
const username = "faizan514pathan@gmail.com";
const password = "jijji.786";
const loginUrl = "https://www.linkedin.com/login";
const DEBUG = false;
const INCLUDE_COMMENTS = true;
const MAX_COMMENT_PAGES = 3; // how many times to click “Load more comments”
const MAX_COMMENTS_PER_POST = 100; // hard cap per post
const STORAGE_STATE_PATH = path.resolve(process.cwd(), 'storageState.json'); // <- session file
// ----------------- Derived file names -----------------
function generateCompanyNames(companyName) {
    const company_slug = companyName.toLowerCase().replace(/\s+/g, '-');
    const companyNameTitle = companyName.replace(/\b\w/g, c => c.toUpperCase());
    return {
        company_slug,
        companyNameTitle,
        pageUrl: `https://www.linkedin.com/company/${company_slug}`,
        companyPostUrl: `https://www.linkedin.com/company/${company_slug}/posts`
    };
}
// ----------------- Selectors -----------------
const SEL_USER = '#username';
const SEL_PASS = '#password';
const SEL_SUBMIT = 'button[type="submit"]';
const SEL_POST_CONTAINER = '.feed-shared-update-v2';
const SEL_POST_TEXT_MAIN = '.update-components-update-v2__commentary .break-words [dir="ltr"]';
const SEL_POST_TEXT_FALLBACKS = [
    '.update-components-update-v2__commentary .break-words',
    '.update-components-text .break-words',
    '.feed-shared-inline-show-more-text',
    '.feed-shared-update-v2__description'
];
const SEL_SEE_MORE = '.feed-shared-inline-show-more-text__see-more-less-toggle';
const SEL_SOCIAL_COUNTS = '.update-v2-social-activity .social-details-social-counts';
const SEL_COMMENTS_BUTTON_STRICT = `${SEL_SOCIAL_COUNTS} .social-details-social-counts__comments button`;
const SEL_TIME = 'time[datetime]';
const SEL_MEDIA_IMG = '.update-components-image img';
// Comments UI
const SEL_COMMENTS_CONTAINER = '.feed-shared-update-v2__comments-container';
const SEL_COMMENT_ITEMS = 'article.comments-comment-entity';
const SEL_COMMENT_TEXT = '.comments-comment-item__main-content .update-components-text';
const SEL_COMMENT_AUTHOR = '.comments-comment-meta__description-title';
const SEL_COMMENT_SUBTITLE = '.comments-comment-meta__description-subtitle';
const SEL_COMMENT_TIME = '.comments-comment-meta__data time';
const SEL_LOAD_MORE_COMMENTS = '.comments-comments-list__load-more-comments-button--cr';
// ----------------- Human-like utilities -----------------
function rand(min = 0, max = 1) { return Math.random() * (max - min) + min; }
function randint(min = 0, max = 10) { return Math.floor(rand(min, max + 1)); }
function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }
function humanPause() {
    return __awaiter(this, arguments, void 0, function* (base = 300, variability = 250) { yield sleep(base + rand(0, variability)); });
}
function humanMove(page_1, targetX_1, targetY_1) {
    return __awaiter(this, arguments, void 0, function* (page, targetX, targetY, steps = 18) {
        var _a, _b;
        const vp = page.viewportSize();
        const sx = ((_a = vp === null || vp === void 0 ? void 0 : vp.width) !== null && _a !== void 0 ? _a : 800) / 2;
        const sy = ((_b = vp === null || vp === void 0 ? void 0 : vp.height) !== null && _b !== void 0 ? _b : 600) / 2;
        for (let i = 0; i < steps; i++) {
            const t = (i + 1) / steps;
            const ease = t * t * (3 - 2 * t); // smoothstep
            const x = Math.round(sx + (targetX - sx) * ease + rand(-2, 2));
            const y = Math.round(sy + (targetY - sy) * ease + rand(-2, 2));
            yield page.mouse.move(x, y, { steps: randint(1, 4) });
            yield sleep(rand(10, 40));
        }
    });
}
function humanClickElement(page, el) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!el)
            return;
        try {
            const box = yield el.boundingBox();
            if (box) {
                const targetX = box.x + rand(8, Math.max(10, box.width - 8));
                const targetY = box.y + rand(8, Math.max(10, box.height - 8));
                yield humanMove(page, targetX, targetY, randint(8, 20));
                yield humanPause(80, 120);
                yield el.click({ timeout: 3000 });
                yield humanPause(120, 300);
            }
            else {
                yield page.evaluate((node) => node.click(), el);
                yield humanPause(200, 300);
            }
        }
        catch (_a) {
            try {
                yield el.click({ timeout: 2000 });
            }
            catch (_b) { }
        }
    });
}
function humanType(el, text) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield el.focus();
        }
        catch (_a) { }
        for (const ch of text) {
            yield el.type(String(ch), { delay: rand(40, 180) });
            if (Math.random() < 0.02) { // occasional correction
                yield sleep(rand(80, 180));
                yield el.press('Backspace');
                yield sleep(rand(60, 180));
                yield el.type(String(ch), { delay: rand(60, 140) });
            }
        }
        yield humanPause(120, 200);
    });
}
function humanScrollTo(page, y) {
    return __awaiter(this, void 0, void 0, function* () {
        const current = yield page.evaluate(() => window.scrollY);
        const distance = Math.abs(y - current);
        const steps = Math.max(6, Math.min(30, Math.floor(distance / 60)));
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const ease = t * t * (3 - 2 * t);
            const yy = Math.round(current + (y - current) * ease + rand(-10, 10));
            yield page.evaluate((val) => window.scrollTo({ top: val, behavior: 'instant' }), yy);
            yield sleep(rand(20, 80));
        }
        yield humanPause(80, 180);
    });
}
// ----------------- Stealth context (supports storageState reuse) -----------------
function makeStealthyContext(browser, storageStatePath) {
    return __awaiter(this, void 0, void 0, function* () {
        const viewportOptions = [
            { width: 1200 + randint(-60, 60), height: 780 + randint(-60, 60) },
            { width: 1366 + randint(-40, 40), height: 768 + randint(-20, 20) },
            { width: 1280 + randint(-30, 30), height: 800 + randint(-30, 30) }
        ];
        const vp = viewportOptions[randint(0, viewportOptions.length - 1)];
        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
        ];
        const ua = userAgents[randint(0, userAgents.length - 1)];
        const contextOpts = {
            viewport: vp,
            userAgent: ua,
            locale: 'en-US',
            timezoneId: 'America/Los_Angeles',
            javaScriptEnabled: true,
            bypassCSP: true,
            extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' }
        };
        if (storageStatePath && fs.existsSync(storageStatePath)) {
            contextOpts.storageState = storageStatePath;
            if (DEBUG)
                console.log('Using saved storageState:', storageStatePath);
        }
        const context = yield browser.newContext(contextOpts);
        // minimal navigator masking
        yield context.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            const origQuery = window.navigator.permissions.query;
            try {
                window.navigator.permissions.query = (params) => params.name === 'notifications' ? Promise.resolve({ state: Notification.permission }) : origQuery(params);
            }
            catch (_a) { }
        });
        return context;
    });
}
// ----------------- Helpers (persist HTML, selectors, etc.) -----------------
function savePageHTML(page, filePath) {
    return __awaiter(this, void 0, void 0, function* () {
        const html = yield page.content();
        yield fs.outputFile(filePath, html, 'utf8');
    });
}
// Expand “…more” inside a post card
function expandSeeMoreInCard(card, page) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const btns = yield card.$$(SEL_SEE_MORE);
            for (const b of btns) {
                yield humanClickElement(page, b);
                yield humanPause(100, 200);
            }
        }
        catch (_a) { }
    });
}
// Click comments button inside a post
function openCommentsInCard(card, page) {
    return __awaiter(this, void 0, void 0, function* () {
        let btn = yield card.$(SEL_COMMENTS_BUTTON_STRICT);
        if (!btn) {
            btn = yield card.$(`${SEL_SOCIAL_COUNTS} [aria-label*="comment" i], ${SEL_SOCIAL_COUNTS} button[aria-label*="comment" i]`);
        }
        if (btn) {
            yield humanClickElement(page, btn);
            yield humanPause(400, 900);
        }
    });
}
// Click “Load more comments” up to N times
function loadMoreCommentsInCard(card, page) {
    return __awaiter(this, void 0, void 0, function* () {
        for (let i = 0; i < MAX_COMMENT_PAGES; i++) {
            const more = yield card.$(SEL_LOAD_MORE_COMMENTS);
            if (!more)
                break;
            yield humanClickElement(page, more);
            yield humanPause(400, 900);
            // IMPORTANT: pass only serializable args; scope to the card root
            const count = yield card.evaluate((root, sel) => root.querySelectorAll(sel).length, SEL_COMMENT_ITEMS);
            if (count >= MAX_COMMENTS_PER_POST)
                break;
        }
    });
}
// Extract a single post’s data (SCOPED to the card!)
function extractPost(card) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield card.evaluate(function (root, cfg) {
            function getInner(el) { return el && 'innerText' in el ? (el.innerText || '').trim() : ''; }
            function pickFirstInner(base, selectors) {
                for (var i = 0; i < selectors.length; i++) {
                    var el = base.querySelector(selectors[i]);
                    var txt = getInner(el);
                    if (txt)
                        return txt;
                }
                return '';
            }
            function parseCount(keyword, scope) {
                var elList = (scope || root).querySelectorAll('[aria-label], button, span, div');
                for (var i = 0; i < elList.length; i++) {
                    var aria = elList[i].getAttribute && elList[i].getAttribute('aria-label');
                    if (aria && new RegExp(keyword, 'i').test(aria))
                        return aria;
                    var txt = getInner(elList[i]);
                    if (txt && new RegExp(keyword, 'i').test(txt))
                        return txt;
                }
                return '';
            }
            function detectMedia(base, selImg) {
                var img = base.querySelector(selImg);
                if (img && img.getAttribute('src'))
                    return { mediaType: 'Image', mediaLink: img.getAttribute('src') || '' };
                var vid = base.querySelector('video, .update-components-video');
                if (vid)
                    return { mediaType: 'Video', mediaLink: '' };
                return { mediaType: 'Unknown', mediaLink: '' };
            }
            // TEXT (scoped to root)
            var text = pickFirstInner(root, [cfg.SEL_POST_TEXT_MAIN].concat(cfg.SEL_POST_TEXT_FALLBACKS));
            // DATE
            var dateRaw = '';
            var t = root.querySelector(cfg.SEL_TIME) || root.querySelector('time');
            if (t)
                dateRaw = (t.getAttribute && t.getAttribute('datetime')) || getInner(t);
            // COUNTS
            var social = root.querySelector(cfg.SEL_SOCIAL_COUNTS) || root;
            var likesRaw = parseCount('reaction|like', social);
            var commentsRaw = parseCount('comment', social);
            var sharesRaw = parseCount('repost|share', social);
            // MEDIA
            var media = detectMedia(root, cfg.SEL_MEDIA_IMG);
            // COMMENTS
            var comments = [];
            var container = root.querySelector(cfg.SEL_COMMENTS_CONTAINER);
            if (container) {
                var items = container.querySelectorAll(cfg.SEL_COMMENT_ITEMS);
                items.forEach(function (it) {
                    var author = getInner(it.querySelector(cfg.SEL_COMMENT_AUTHOR));
                    var subtitle = getInner(it.querySelector(cfg.SEL_COMMENT_SUBTITLE));
                    var time = getInner(it.querySelector(cfg.SEL_COMMENT_TIME));
                    var ctext = getInner(it.querySelector(cfg.SEL_COMMENT_TEXT));
                    if (author || ctext)
                        comments.push({ author, subtitle, time, text: ctext });
                });
            }
            return {
                text,
                dateRaw,
                dateISO: dateRaw,
                likesRaw,
                likesNumeric: 0,
                commentsRaw,
                commentsNumeric: 0,
                sharesRaw,
                sharesNumeric: 0,
                mediaType: media.mediaType,
                mediaLink: media.mediaLink,
                comments
            };
        }, {
            SEL_POST_TEXT_MAIN,
            SEL_POST_TEXT_FALLBACKS,
            SEL_TIME,
            SEL_SOCIAL_COUNTS,
            SEL_MEDIA_IMG,
            SEL_COMMENTS_CONTAINER,
            SEL_COMMENT_ITEMS,
            SEL_COMMENT_TEXT,
            SEL_COMMENT_AUTHOR,
            SEL_COMMENT_SUBTITLE,
            SEL_COMMENT_TIME
        });
    });
}
// ----------------- Date / number helpers -----------------
function getActualDate(raw) {
    const today = new Date();
    const current_year = today.getFullYear();
    function getPastDate(opts) {
        const { days = 0, weeks = 0, months = 0, years = 0 } = opts;
        let d = today;
        if (days)
            d = (0, date_fns_1.subDays)(d, days);
        if (weeks)
            d = (0, date_fns_1.subWeeks)(d, weeks);
        if (months)
            d = (0, date_fns_1.subMonths)(d, months);
        if (years)
            d = (0, date_fns_1.subYears)(d, years);
        return (0, date_fns_1.format)(d, 'yyyy-MM-dd');
    }
    const date = (raw || '').trim().toLowerCase();
    if (!date)
        return (0, date_fns_1.format)(today, 'yyyy-MM-dd');
    if (date.includes('hour'))
        return (0, date_fns_1.format)(today, 'yyyy-MM-dd');
    if (date.includes('day'))
        return getPastDate({ days: parseInt(date, 10) || 0 });
    if (date.includes('week'))
        return getPastDate({ weeks: parseInt(date, 10) || 0 });
    if (date.includes('month'))
        return getPastDate({ months: parseInt(date, 10) || 0 });
    if (date.includes('year'))
        return getPastDate({ years: parseInt(date, 10) || 0 });
    // Fallback MM-DD or MM-DD-YYYY
    const parts = date.split('-');
    if (parts.length === 2) {
        let [m, d] = parts;
        if (m.length < 2)
            m = '0' + m;
        if (d.length < 2)
            d = '0' + d;
        return `${current_year}-${m}-${d}`;
    }
    if (parts.length === 3) {
        let [m, d, y] = parts;
        if (m.length < 2)
            m = '0' + m;
        if (d.length < 2)
            d = '0' + d;
        return `${y}-${m}-${d}`;
    }
    return (0, date_fns_1.format)(today, 'yyyy-MM-dd');
}
function convertAbbreviatedToNumber(s) {
    if (!s)
        return 0;
    const numPart = (s.match(/[\d,.]+(?:\s*[KM])?/i) || [''])[0].replace(/[,\u00A0]/g, '');
    const up = numPart.toUpperCase();
    if (up.endsWith('K'))
        return Math.round(parseFloat(up) * 1000);
    if (up.endsWith('M'))
        return Math.round(parseFloat(up) * 1000000);
    const n = parseInt(numPart, 10);
    return Number.isFinite(n) ? n : 0;
}
// ----------------- CSV / JSON export -----------------
function exportCsv(filePath, rows) {
    return __awaiter(this, void 0, void 0, function* () {
        yield fs.ensureFile(filePath);
        const stream = fs.createWriteStream(filePath);
        const csv = (0, format_1.format)({ headers: true });
        csv.pipe(stream);
        rows.forEach(r => csv.write(r));
        csv.end();
    });
}
// ----------------- Main Scraping Function -----------------
function scrapeCompanyPosts(companyName) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const { pageUrl, companyPostUrl, companyNameTitle } = generateCompanyNames(companyName);
        const browser = yield playwright_1.chromium.launch({
            headless: false,
            args: ['--disable-blink-features=AutomationControlled'],
            proxy: {
                server: 'http://gw.dataimpulse.com:823',
                username: '2cef711aaa1a060b00b2',
                password: '71e56626760e1077'
            },
        });
        // If storage state exists, pass path to makeStealthyContext so it will be used.
        const context = yield makeStealthyContext(browser, fs.existsSync(STORAGE_STATE_PATH) ? STORAGE_STATE_PATH : undefined);
        const page = yield context.newPage();
        try {
            yield humanPause(400, 800);
            // If we don't have a saved storage state, perform login then save it.
            const hasSavedState = fs.existsSync(STORAGE_STATE_PATH);
            if (!hasSavedState) {
                // LOGIN
                yield page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
                yield humanPause(600, 900);
                const userEl = yield page.$(SEL_USER);
                const passEl = yield page.$(SEL_PASS);
                if (userEl && passEl) {
                    yield humanClickElement(page, userEl);
                    yield humanType(userEl, username);
                    yield humanClickElement(page, passEl);
                    yield humanType(passEl, password);
                    const submit = yield page.$(SEL_SUBMIT);
                    if (submit)
                        yield humanClickElement(page, submit);
                    else
                        yield page.keyboard.press('Enter');
                }
                else {
                    // If the login inputs are not found, still navigate to login and wait
                    yield page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
                }
                // Wait for something that indicates login success — e.g. presence of the profile nav or redirect away from login page
                try {
                    yield page.waitForTimeout(240000); // wait 4 mins
                    yield page.waitForNavigation({ timeout: 15000, waitUntil: 'domcontentloaded' });
                }
                catch (e) {
                    // navigation may not occur; continue and check for logged-in indicator
                }
                yield humanPause(1500, 2500);
                // Basic heuristic: if page contains profile menu or feed, assume logged in
                const loggedInIndicator = yield page.$('header, nav, #profile-nav-item, .global-nav__me-photo, .nav-item__profile-member-photo');
                if (loggedInIndicator) {
                    // save storage state (cookies + localStorage)
                    yield context.storageState({ path: STORAGE_STATE_PATH });
                    if (DEBUG)
                        console.log('Saved storageState to', STORAGE_STATE_PATH);
                }
                else {
                    // Try a second check: check if cookie named li_at exists
                    const cookies = yield context.cookies();
                    const hasLiAt = cookies.some(c => c.name === 'li_at');
                    if (hasLiAt) {
                        yield context.storageState({ path: STORAGE_STATE_PATH });
                        if (DEBUG)
                            console.log('Saved storageState (cookie-based) to', STORAGE_STATE_PATH);
                    }
                    else {
                        console.warn('Login probably failed or required MFA. No storageState saved.');
                    }
                }
            }
            else if (DEBUG) {
                console.log('Loaded context with storageState from', STORAGE_STATE_PATH);
            }
            yield page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' });
            yield page.goto(pageUrl, { waitUntil: 'domcontentloaded' });
            yield humanPause(800, 1400);
            yield page.goto(companyPostUrl, { waitUntil: 'domcontentloaded' });
            yield humanPause(600, 1000);
            yield savePageHTML(page, `${companyNameTitle}_initial.html`);
            // Gentle random scrolls to load more posts
            const docH = yield page.evaluate(() => document.body.scrollHeight || 2000);
            const rounds = randint(3, 7);
            for (let i = 0; i < rounds; i++) {
                const to = Math.round(rand(200, docH - 200));
                yield humanScrollTo(page, to);
                yield humanPause(400, 1200);
            }
            yield humanPause(900, 1600);
            yield savePageHTML(page, `${companyNameTitle}_final.html`);
            // Collect cards
            const cards = yield page.$$(SEL_POST_CONTAINER);
            const results = [];
            for (let i = 0; i < cards.length; i++) {
                const card = cards[i];
                try {
                    yield humanPause(300, 800);
                    const box = yield card.boundingBox();
                    if (box)
                        yield humanScrollTo(page, Math.max(0, box.y - 120));
                    yield expandSeeMoreInCard(card, page);
                    if (INCLUDE_COMMENTS) {
                        yield openCommentsInCard(card, page);
                        try {
                            yield card.waitForSelector(SEL_COMMENTS_CONTAINER, { timeout: 2000 });
                        }
                        catch (_b) { }
                        yield loadMoreCommentsInCard(card, page);
                    }
                    const data = yield extractPost(card);
                    data.dateISO = getActualDate(data.dateRaw);
                    data.likesNumeric = convertAbbreviatedToNumber(data.likesRaw);
                    data.commentsNumeric = convertAbbreviatedToNumber(data.commentsRaw);
                    data.sharesNumeric = convertAbbreviatedToNumber(data.sharesRaw);
                    results.push(data);
                    if (DEBUG) {
                        console.log(`Post #${i + 1}`, {
                            text: (data.text || '').slice(0, 80),
                            comments: ((_a = data.comments) === null || _a === void 0 ? void 0 : _a.length) || 0
                        });
                    }
                    yield humanPause(900 + Math.random() * 1200, 1500);
                }
                catch (err) {
                    console.warn(`Post #${i + 1} error`, err);
                }
                finally {
                    try {
                        yield card.dispose();
                    }
                    catch (_c) { }
                }
            }
            // Sort by engagement
            results.sort((a, b) => (b.likesNumeric || 0) - (a.likesNumeric || 0));
            return results;
        }
        finally {
            try {
                yield page.close();
            }
            catch (_d) { }
            try {
                yield context.close();
            }
            catch (_e) { }
            try {
                yield browser.close();
            }
            catch (_f) { }
        }
    });
}
// ----------------- Legacy Main Function (for backwards compatibility) -----------------
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        const companyName = "ClickUp"; // Default company for legacy usage
        const { companyNameTitle } = generateCompanyNames(companyName);
        try {
            const results = yield scrapeCompanyPosts(companyName);
            // Export results
            yield exportCsv(`${companyNameTitle}_posts.csv`, results.map((_a) => {
                var { comments } = _a, flat = __rest(_a, ["comments"]);
                return flat;
            }));
            yield fs.writeJson(`${companyNameTitle}_posts_with_comments.json`, results, { spaces: 2 });
            console.log('Exported CSV + JSON.');
        }
        catch (error) {
            console.error('Scraping failed:', error);
            throw error;
        }
    });
}
