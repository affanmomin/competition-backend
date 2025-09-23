// @ts-nocheck
/**
 * linkedin-scraper-stealth.ts
 * Scrapes LinkedIn company posts + comments with human-like behaviour.
 * Usage: npx tsx src/linkedin-scraper-stealth.ts
 * IMPORTANT: Respect LinkedIn's Terms of Service.
 */

import { chromium, Page, ElementHandle, BrowserContext, Browser } from 'playwright';
import * as fs from 'fs-extra';
import * as path from 'path';
import { format as csvFormat } from '@fast-csv/format';
import { subDays, subWeeks, subMonths, subYears, format as dfFormat } from 'date-fns';

// ----------------- CONFIG -----------------
const username = "faizan514pathan@gmail.com";
const password = "jijji.786";
const pageUrl  = "https://www.linkedin.com/company/clickup-app";
const companyPostUrl = "https://www.linkedin.com/company/clickup-app/posts";
const loginUrl = "https://www.linkedin.com/login";

const DEBUG = false;

const INCLUDE_COMMENTS = true;
const MAX_COMMENT_PAGES = 3;        // how many times to click “Load more comments”
const MAX_COMMENTS_PER_POST = 100;  // hard cap per post

const STORAGE_STATE_PATH = path.resolve(process.cwd(), 'storageState.json'); // <- session file

// ----------------- Derived file names -----------------
const company_name = pageUrl.replace(/\/+$/, '').split('/').pop()!.replace(/-/g, ' ');
const companyNameTitle = company_name.replace(/\b\w/g, c => c.toUpperCase());

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
const SEL_COMMENT_ITEMS      = 'article.comments-comment-entity';
const SEL_COMMENT_TEXT       = '.comments-comment-item__main-content .update-components-text';
const SEL_COMMENT_AUTHOR     = '.comments-comment-meta__description-title';
const SEL_COMMENT_SUBTITLE   = '.comments-comment-meta__description-subtitle';
const SEL_COMMENT_TIME       = '.comments-comment-meta__data time';
const SEL_LOAD_MORE_COMMENTS = '.comments-comments-list__load-more-comments-button--cr';

// ----------------- Human-like utilities -----------------
function rand(min = 0, max = 1) { return Math.random() * (max - min) + min; }
function randint(min = 0, max = 10) { return Math.floor(rand(min, max + 1)); }
function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }
async function humanPause(base = 300, variability = 250) { await sleep(base + rand(0, variability)); }

async function humanMove(page: Page, targetX: number, targetY: number, steps = 18) {
  const vp = page.viewportSize();
  const sx = (vp?.width ?? 800) / 2;
  const sy = (vp?.height ?? 600) / 2;
  for (let i = 0; i < steps; i++) {
    const t = (i + 1) / steps;
    const ease = t * t * (3 - 2 * t); // smoothstep
    const x = Math.round(sx + (targetX - sx) * ease + rand(-2, 2));
    const y = Math.round(sy + (targetY - sy) * ease + rand(-2, 2));
    await page.mouse.move(x, y, { steps: randint(1, 4) });
    await sleep(rand(10, 40));
  }
}

async function humanClickElement(page: Page, el: ElementHandle<Element> | null) {
  if (!el) return;
  try {
    const box = await el.boundingBox();
    if (box) {
      const targetX = box.x + rand(8, Math.max(10, box.width - 8));
      const targetY = box.y + rand(8, Math.max(10, box.height - 8));
      await humanMove(page, targetX, targetY, randint(8, 20));
      await humanPause(80, 120);
      await el.click({ timeout: 3000 });
      await humanPause(120, 300);
    } else {
      await page.evaluate((node) => (node as HTMLElement).click(), el);
      await humanPause(200, 300);
    }
  } catch {
    try { await el.click({ timeout: 2000 }); } catch {}
  }
}

async function humanType(el: ElementHandle, text: string) {
  try { await el.focus(); } catch {}
  for (const ch of text) {
    await el.type(String(ch), { delay: rand(40, 180) });
    if (Math.random() < 0.02) { // occasional correction
      await sleep(rand(80, 180));
      await el.press('Backspace');
      await sleep(rand(60, 180));
      await el.type(String(ch), { delay: rand(60, 140) });
    }
  }
  await humanPause(120, 200);
}

async function humanScrollTo(page: Page, y: number) {
  const current = await page.evaluate(() => window.scrollY);
  const distance = Math.abs(y - current);
  const steps = Math.max(6, Math.min(30, Math.floor(distance / 60)));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const ease = t * t * (3 - 2 * t);
    const yy = Math.round(current + (y - current) * ease + rand(-10, 10));
    await page.evaluate((val) => window.scrollTo({ top: val, behavior: 'instant' }), yy);
    await sleep(rand(20, 80));
  }
  await humanPause(80, 180);
}

// ----------------- Stealth context (supports storageState reuse) -----------------
async function makeStealthyContext(browser: Browser, storageStatePath?: string): Promise<BrowserContext> {
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

  const contextOpts: any = {
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
    if (DEBUG) console.log('Using saved storageState:', storageStatePath);
  }

  const context = await browser.newContext(contextOpts);

  // minimal navigator masking
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    const origQuery = window.navigator.permissions.query;
    try {
      window.navigator.permissions.query = (params) =>
        params.name === 'notifications' ? Promise.resolve({ state: Notification.permission }) : origQuery(params);
    } catch {}
  });

  return context;
}

// ----------------- Helpers (persist HTML, selectors, etc.) -----------------
async function savePageHTML(page: Page, filePath: string) {
  const html = await page.content();
  await fs.outputFile(filePath, html, 'utf8');
}

// Expand “…more” inside a post card
async function expandSeeMoreInCard(card: ElementHandle<Element>, page: Page) {
  try {
    const btns = await card.$$(SEL_SEE_MORE);
    for (const b of btns) {
      await humanClickElement(page, b);
      await humanPause(100, 200);
    }
  } catch {}
}

// Click comments button inside a post
async function openCommentsInCard(card: ElementHandle<Element>, page: Page) {
  let btn = await card.$(SEL_COMMENTS_BUTTON_STRICT);
  if (!btn) {
    btn = await card.$(`${SEL_SOCIAL_COUNTS} [aria-label*="comment" i], ${SEL_SOCIAL_COUNTS} button[aria-label*="comment" i]`);
  }
  if (btn) {
    await humanClickElement(page, btn);
    await humanPause(400, 900);
  }
}

// Click “Load more comments” up to N times
async function loadMoreCommentsInCard(card: ElementHandle<Element>, page: Page) {
  for (let i = 0; i < MAX_COMMENT_PAGES; i++) {
    const more = await card.$(SEL_LOAD_MORE_COMMENTS);
    if (!more) break;
    await humanClickElement(page, more);
    await humanPause(400, 900);

    // IMPORTANT: pass only serializable args; scope to the card root
    const count = await card.evaluate((root, sel) => root.querySelectorAll(sel).length, SEL_COMMENT_ITEMS);
    if (count >= MAX_COMMENTS_PER_POST) break;
  }
}

// Extract a single post’s data (SCOPED to the card!)
async function extractPost(card: ElementHandle<Element>) {
  return await card.evaluate(function (root, cfg) {
    function getInner(el) { return el && 'innerText' in el ? (el.innerText || '').trim() : ''; }
    function pickFirstInner(base, selectors) {
      for (var i = 0; i < selectors.length; i++) {
        var el = base.querySelector(selectors[i]);
        var txt = getInner(el);
        if (txt) return txt;
      }
      return '';
    }
    function parseCount(keyword, scope) {
      var elList = (scope || root).querySelectorAll('[aria-label], button, span, div');
      for (var i = 0; i < elList.length; i++) {
        var aria = elList[i].getAttribute && elList[i].getAttribute('aria-label');
        if (aria && new RegExp(keyword, 'i').test(aria)) return aria;
        var txt = getInner(elList[i]);
        if (txt && new RegExp(keyword, 'i').test(txt)) return txt;
      }
      return '';
    }
    function detectMedia(base, selImg) {
      var img = base.querySelector(selImg);
      if (img && img.getAttribute('src')) return { mediaType: 'Image', mediaLink: img.getAttribute('src') || '' };
      var vid = base.querySelector('video, .update-components-video');
      if (vid) return { mediaType: 'Video', mediaLink: '' };
      return { mediaType: 'Unknown', mediaLink: '' };
    }

    // TEXT (scoped to root)
    var text = pickFirstInner(root, [cfg.SEL_POST_TEXT_MAIN].concat(cfg.SEL_POST_TEXT_FALLBACKS));

    // DATE
    var dateRaw = '';
    var t = root.querySelector(cfg.SEL_TIME) || root.querySelector('time');
    if (t) dateRaw = (t.getAttribute && t.getAttribute('datetime')) || getInner(t);

    // COUNTS
    var social = root.querySelector(cfg.SEL_SOCIAL_COUNTS) || root;
    var likesRaw    = parseCount('reaction|like', social);
    var commentsRaw = parseCount('comment',       social);
    var sharesRaw   = parseCount('repost|share',  social);

    // MEDIA
    var media = detectMedia(root, cfg.SEL_MEDIA_IMG);

    // COMMENTS
    var comments = [];
    var container = root.querySelector(cfg.SEL_COMMENTS_CONTAINER);
    if (container) {
      var items = container.querySelectorAll(cfg.SEL_COMMENT_ITEMS);
      items.forEach(function (it) {
        var author   = getInner(it.querySelector(cfg.SEL_COMMENT_AUTHOR));
        var subtitle = getInner(it.querySelector(cfg.SEL_COMMENT_SUBTITLE));
        var time     = getInner(it.querySelector(cfg.SEL_COMMENT_TIME));
        var ctext    = getInner(it.querySelector(cfg.SEL_COMMENT_TEXT));
        if (author || ctext) comments.push({ author, subtitle, time, text: ctext });
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
}

// ----------------- Date / number helpers -----------------
function getActualDate(raw: string): string {
  const today = new Date();
  const current_year = today.getFullYear();

  function getPastDate(opts: { days?: number; weeks?: number; months?: number; years?: number }) {
    const { days = 0, weeks = 0, months = 0, years = 0 } = opts;
    let d = today;
    if (days) d = subDays(d, days);
    if (weeks) d = subWeeks(d, weeks);
    if (months) d = subMonths(d, months);
    if (years) d = subYears(d, years);
    return dfFormat(d, 'yyyy-MM-dd');
  }

  const date = (raw || '').trim().toLowerCase();
  if (!date) return dfFormat(today, 'yyyy-MM-dd');

  if (date.includes('hour')) return dfFormat(today, 'yyyy-MM-dd');
  if (date.includes('day'))  return getPastDate({ days:   parseInt(date, 10) || 0 });
  if (date.includes('week')) return getPastDate({ weeks:  parseInt(date, 10) || 0 });
  if (date.includes('month'))return getPastDate({ months: parseInt(date, 10) || 0 });
  if (date.includes('year')) return getPastDate({ years:  parseInt(date, 10) || 0 });

  // Fallback MM-DD or MM-DD-YYYY
  const parts = date.split('-');
  if (parts.length === 2) {
    let [m, d] = parts;
    if (m.length < 2) m = '0' + m;
    if (d.length < 2) d = '0' + d;
    return `${current_year}-${m}-${d}`;
  }
  if (parts.length === 3) {
    let [m, d, y] = parts;
    if (m.length < 2) m = '0' + m;
    if (d.length < 2) d = '0' + d;
    return `${y}-${m}-${d}`;
  }
  return dfFormat(today, 'yyyy-MM-dd');
}

function convertAbbreviatedToNumber(s: string): number {
  if (!s) return 0;
  const numPart = (s.match(/[\d,.]+(?:\s*[KM])?/i) || [''])[0].replace(/[,\u00A0]/g, '');
  const up = numPart.toUpperCase();
  if (up.endsWith('K')) return Math.round(parseFloat(up) * 1_000);
  if (up.endsWith('M')) return Math.round(parseFloat(up) * 1_000_000);
  const n = parseInt(numPart, 10);
  return Number.isFinite(n) ? n : 0;
}

// ----------------- CSV / JSON export -----------------
async function exportCsv(filePath: string, rows: any[]) {
  await fs.ensureFile(filePath);
  const stream = fs.createWriteStream(filePath);
  const csv = csvFormat({ headers: true });
  csv.pipe(stream);
  rows.forEach(r => csv.write(r));
  csv.end();
}

// ----------------- Main -----------------
async function run() {
  const browser = await chromium.launch({ headless: false,  args: ['--disable-blink-features=AutomationControlled'], 
    proxy: {
    server: 'http://gw.dataimpulse.com:823',
    username: '2cef711aaa1a060b00b2',
    password: '71e56626760e1077'  
  },
});

  // If storage state exists, pass path to makeStealthyContext so it will be used.
  const context = await makeStealthyContext(browser, fs.existsSync(STORAGE_STATE_PATH) ? STORAGE_STATE_PATH : undefined);
  const page = await context.newPage();

  try {
    await humanPause(400, 800);

    // If we don't have a saved storage state, perform login then save it.
    const hasSavedState = fs.existsSync(STORAGE_STATE_PATH);

    if (!hasSavedState) {
      // LOGIN
      await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
      await humanPause(600, 900);

      const userEl = await page.$(SEL_USER);
      const passEl = await page.$(SEL_PASS);
      if (userEl && passEl) {
        await humanClickElement(page, userEl);
        await humanType(userEl, username);
        await humanClickElement(page, passEl);
        await humanType(passEl, password);
        const submit = await page.$(SEL_SUBMIT);
        if (submit) await humanClickElement(page, submit); else await page.keyboard.press('Enter');
      } else {
        // If the login inputs are not found, still navigate to login and wait
        await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
      }

      // Wait for something that indicates login success — e.g. presence of the profile nav or redirect away from login page
      try {
        await page.waitForTimeout(240000); // wait 4 mins
        await page.waitForNavigation({ timeout: 15000, waitUntil: 'domcontentloaded' });
      } catch (e) {
        // navigation may not occur; continue and check for logged-in indicator
      }
      await humanPause(1500, 2500);

      // Basic heuristic: if page contains profile menu or feed, assume logged in
      const loggedInIndicator = await page.$('header, nav, #profile-nav-item, .global-nav__me-photo, .nav-item__profile-member-photo');
      if (loggedInIndicator) {
        // save storage state (cookies + localStorage)
        await context.storageState({ path: STORAGE_STATE_PATH });
        if (DEBUG) console.log('Saved storageState to', STORAGE_STATE_PATH);
      } else {
        // Try a second check: check if cookie named li_at exists
        const cookies = await context.cookies();
        const hasLiAt = cookies.some(c => c.name === 'li_at');
        if (hasLiAt) {
          await context.storageState({ path: STORAGE_STATE_PATH });
          if (DEBUG) console.log('Saved storageState (cookie-based) to', STORAGE_STATE_PATH);
        } else {
          console.warn('Login probably failed or required MFA. No storageState saved.');
        }
      }
    } else if (DEBUG) {
      console.log('Loaded context with storageState from', STORAGE_STATE_PATH);
    }
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' });

    await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });

    await humanPause(800, 1400);
    await page.goto(companyPostUrl, { waitUntil: 'domcontentloaded' });
    await humanPause(600, 1000);

    // Now go to posts page and continue scraping
    // let post_page = pageUrl.replace(/\/+$/, '') + '/posts';
    // post_page = post_page.replace('//posts', '/posts');
    // await page.goto(post_page, { waitUntil: 'domcontentloaded' });
    // await humanPause(600, 1000);

    await savePageHTML(page, `${companyNameTitle}_initial.html`);

    // Gentle random scrolls to load more posts
    const docH = await page.evaluate(() => document.body.scrollHeight || 2000);
    const rounds = randint(3, 7);
    for (let i = 0; i < rounds; i++) {
      const to = Math.round(rand(200, docH - 200));
      await humanScrollTo(page, to);
      await humanPause(400, 1200);
    }

    await humanPause(900, 1600);
    await savePageHTML(page, `${companyNameTitle}_final.html`);

    // Collect cards
    const cards = await page.$$(SEL_POST_CONTAINER);
    const results: any[] = [];

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      try {
        await humanPause(300, 800);

        const box = await card.boundingBox();
        if (box) await humanScrollTo(page, Math.max(0, box.y - 120));

        await expandSeeMoreInCard(card, page);

        if (INCLUDE_COMMENTS) {
          await openCommentsInCard(card, page);
          try { await card.waitForSelector(SEL_COMMENTS_CONTAINER, { timeout: 2000 }); } catch {}
          await loadMoreCommentsInCard(card, page);
        }

        const data = await extractPost(card);
        data.dateISO = getActualDate(data.dateRaw);
        data.likesNumeric = convertAbbreviatedToNumber(data.likesRaw);
        data.commentsNumeric = convertAbbreviatedToNumber(data.commentsRaw);
        data.sharesNumeric = convertAbbreviatedToNumber(data.sharesRaw);
        results.push(data);

        if (DEBUG) {
          console.log(`Post #${i + 1}`, {
            text: (data.text || '').slice(0, 80),
            comments: data.comments?.length || 0
          });
        }

        await humanPause(900 + Math.random() * 1200, 1500);
      } catch (err) {
        console.warn(`Post #${i + 1} error`, err);
      } finally {
        try { await card.dispose(); } catch {}
      }
    }

    // Sort & export
    results.sort((a, b) => (b.likesNumeric || 0) - (a.likesNumeric || 0));
    await exportCsv(`${companyNameTitle}_posts.csv`, results.map(({ comments, ...flat }) => flat));
    await fs.writeJson(`${companyNameTitle}_posts_with_comments.json`, results, { spaces: 2 });
    console.log('Exported CSV + JSON.');
  } finally {
    try { await page.close(); } catch {}
    try { await context.close(); } catch {}
    try { await browser.close(); } catch {}
  }
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
