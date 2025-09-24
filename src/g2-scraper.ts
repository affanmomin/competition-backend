// @ts-nocheck
/**
 * g2-scraper-stealth.ts
 * Scrapes G2 product: reviews (first N pages), features, alternatives
 * with human-like behaviour & export (CSV + JSON).
 *
 * Usage:
 *   npx tsx src/g2-scraper-stealth.ts
 */

import { chromium, Page, ElementHandle, BrowserContext, Browser } from 'playwright';
import * as fs from 'fs-extra';
import * as path from 'path';
import { format as csvFormat } from '@fast-csv/format';
import { format as dfFormat } from 'date-fns';

// ----------------- CONFIG -----------------
const PRODUCT_SLUG = 'linear';
const BASE_URL = `https://www.g2.com/products/${PRODUCT_SLUG}`;
const REVIEWS_URL = `${BASE_URL}/reviews?source=search`;
const PAGES_TO_SCRAPE = 3;

const DEBUG = false;
const STORAGE_STATE_PATH = path.resolve(process.cwd(), `storageState.g2.${PRODUCT_SLUG}.json`);

// Optional: proxy (uncomment if needed)
// const PROXY = {
//   server: 'http://gw.dataimpulse.com:823',
//   username: 'USER',
//   password: 'PASS',
// };

// ----------------- Selectors (multiple fallbacks) -----------------
const SEL_REVIEW_CARD = [
  'article[data-component="ReviewCard"]',
  'article.review',
  'div[data-testid="review-card"]',
  'div.review-card',
  'article'
];

const SEL_TITLE = [
  '[data-testid="review-title"]',
  'h3',
  '.review-title',
  '.review__title',
  'h2'
];

const SEL_BODY = [
  '[data-testid="review-body"]',
  '.review-body',
  '.review__body',
  '.c-review__body',
  'section p'
];

const SEL_AUTHOR = [
  '[data-testid="reviewer-name"]',
  '.reviewer-name',
  '.user-name',
  '.review-user',
  '.c-reviewer__name'
];

const SEL_DATE = [
  'time[datetime]',
  '.review-date time',
  '.review-date',
  '.c-review__date',
  'time'
];

const SEL_RATING = [
  '[data-testid="rating"]',
  '.review-rating',
  '.rating',
  'svg[aria-label*="star" i]'
];

const SEL_PROS = [
  'section:has(h4:has-text("What do you like best"))) p',
  'section:has(h4:has-text("Pros")) p',
  'section:has-text("What do you like best") p',
  '.pros, .review-pros'
];

const SEL_CONS = [
  'section:has(h4:has-text("What do you dislike"))) p',
  'section:has(h4:has-text("Cons")) p',
  'section:has-text("What do you dislike") p',
  '.cons, .review-cons'
];

// Features / alternatives on product page
const SEL_FEATURES_SECTIONS = [
  'section:has(h2:has-text("Features"))',
  '[data-testid="features"]',
  '.product-features',
  '.features-list',
  'section:has-text("Features")'
];

const SEL_ALTERNATIVES_SECTIONS = [
  'section:has(h2:has-text("Alternatives"))',
  'aside:has(h2:has-text("Alternatives"))',
  '.alternatives, .competitors, .comparison-list',
  '[data-testid="alternatives"]'
];

// ----------------- Human-like utils -----------------
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
    const ease = t * t * (3 - 2 * t);
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

// ----------------- Stealth context -----------------
async function makeStealthyContext(browser: Browser, storageStatePath?: string): Promise<BrowserContext> {
  const viewportOptions = [
    { width: 1200 + randint(-60, 60), height: 780 + randint(-60, 60) },
    { width: 1366 + randint(-40, 40), height: 768 + randint(-20, 20) },
    { width: 1280 + randint(-30, 30), height: 800 + randint(-30, 30) }
  ];
  const vp = viewportOptions[randint(0, viewportOptions.length - 1)];

  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36'
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

  // if (PROXY) contextOpts.proxy = PROXY;

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

// ----------------- Helpers -----------------
async function savePageHTML(page: Page, filePath: string) {
  const html = await page.content();
  await fs.outputFile(filePath, html, 'utf8');
}

async function exportCsv(filePath: string, rows: any[]) {
  await fs.ensureFile(filePath);
  const stream = fs.createWriteStream(filePath);
  const csv = csvFormat({ headers: true });
  csv.pipe(stream);
  rows.forEach(r => csv.write(r));
  csv.end();
}

function convertAbbrevNumber(s: string): number {
  if (!s) return 0;
  const m = s.replace(/[,\u00A0]/g, '').match(/([\d.]+)\s*([KM])?/i);
  if (!m) return parseInt(s, 10) || 0;
  const n = parseFloat(m[1]);
  const suffix = (m[2] || '').toUpperCase();
  if (suffix === 'K') return Math.round(n * 1_000);
  if (suffix === 'M') return Math.round(n * 1_000_000);
  return Math.round(n);
}

async function pickFirstText(root: ElementHandle, selectors: string[]) {
  for (const sel of selectors) {
    try {
      const el = await root.$(sel);
      if (el) {
        const txt = (await el.innerText()).trim();
        if (txt) return txt;
      }
    } catch {}
  }
  return '';
}

// Extract review card (scoped)
async function extractReviewCard(card: ElementHandle<Element>) {
  const title = await pickFirstText(card, SEL_TITLE);
  const body  = await pickFirstText(card, SEL_BODY);
  const author = await pickFirstText(card, SEL_AUTHOR);

  // date
  let dateISO = '';
  try {
    const t = await card.$(SEL_DATE.join(', '));
    if (t) {
      const raw = (await t.getAttribute('datetime')) || (await t.innerText()) || '';
      dateISO = raw.trim();
    }
  } catch {}

  // rating
  let rating = null;
  try {
    const r = await card.$(SEL_RATING.join(', '));
    if (r) {
      const label = await r.getAttribute('aria-label');
      const text = (await r.innerText().catch(()=>'')) || '';
      const raw = (label || text || '').match(/([0-5](?:\.[0-9])?)/);
      if (raw) rating = parseFloat(raw[1]);
    }
  } catch {}

  // pros / cons
  const pros = await pickFirstText(card, SEL_PROS);
  const cons = await pickFirstText(card, SEL_CONS);

  return { title, body, author, dateISO, rating, pros, cons };
}

// Scroll a bit like a human on each page
async function gentlePageWarmup(page: Page) {
  const docH = await page.evaluate(() => document.body.scrollHeight || 2000);
  const rounds = randint(3, 6);
  for (let i = 0; i < rounds; i++) {
    const to = Math.round(rand(150, docH - 200));
    await humanScrollTo(page, to);
    await humanPause(300, 900);
  }
}

// ----------------- Product page: features & alternatives -----------------
async function scrapeProductMeta(page: Page) {
  const product = { features: [] as string[], alternatives: [] as { name: string; href: string | null }[] };

  // Features
  for (const sel of SEL_FEATURES_SECTIONS) {
    const sec = await page.$(sel);
    if (sec) {
      const items = await sec.$$eval('li, .feature, .feature-item, p', els =>
        els.map(e => (e.textContent || '').trim()).filter(Boolean)
      ).catch(() => []);
      if (items.length) { product.features = items; break; }
    }
  }
  if (!product.features.length) {
    // Fallback: pick some descriptive bullets near headings mentioning Features
    const bullets = await page.$$eval('ul li', els => els.map(e => e.textContent?.trim() || '').filter(Boolean)).catch(()=>[]);
    product.features = bullets.slice(0, 10);
  }

  // Alternatives
  for (const sel of SEL_ALTERNATIVES_SECTIONS) {
    const node = await page.$(sel);
    if (node) {
      const alts = await node.$$eval('a, li, .alternative', els =>
        els.map(e => {
          const text = (e.textContent || '').trim();
          let href: string | null = null;
          const a = (e as HTMLElement).querySelector?.('a');
          href = a?.getAttribute('href') || (e as HTMLAnchorElement).getAttribute?.('href') || null;
          return text ? { name: text, href } : null;
        }).filter(Boolean)
      ).catch(() => []);
      if (alts.length) { product.alternatives = alts as any; }
      if (product.alternatives.length) break;
    }
  }
  if (!product.alternatives.length) {
    const alts = await page.$$eval('a', as =>
      as.map(a => ({ name: (a.textContent || '').trim(), href: a.getAttribute('href') }))
        .filter(a => a.name && /alternative|alternatives|compare|competitor/i.test(a.name))
        .slice(0, 12)
    ).catch(() => []);
    product.alternatives = alts as any;
  }

  return product;
}

// ----------------- Main scrape -----------------
export async function scrapeG2(productSlug: string): Promise<any> {
  const baseUrl = `https://www.g2.com/products/${productSlug}`;
  const reviewsUrl = `${baseUrl}/reviews?source=search`;
  const storageStatePath = path.resolve(process.cwd(), `storageState.g2.${productSlug}.json`);

  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
      proxy:{
      server: 'http://gw.dataimpulse.com:823',
      username: '2cef711aaa1a060b00b2',
      password: '71e56626760e1077'  
    }
  });

  const context = await makeStealthyContext(browser, fs.existsSync(storageStatePath) ? storageStatePath : undefined);
  const page = await context.newPage();

  try {
    // 1) Product meta
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await humanPause(600, 1200);
    await gentlePageWarmup(page);

    const productMeta = await scrapeProductMeta(page);
    if (DEBUG) console.log('features:', productMeta.features.length, 'alternatives:', productMeta.alternatives.length);

    // 2) Reviews: first N pages
    const allReviews: any[] = [];

    for (let p = 1; p <= PAGES_TO_SCRAPE; p++) {
      const url = new URL(reviewsUrl);
      url.searchParams.set('page', String(p));
      const pageUrl = url.toString();

      if (DEBUG) console.log('visiting', pageUrl);

      await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await humanPause(700, 1200);
      await gentlePageWarmup(page);

      // pick a working review container selector
      let containerSel = '';
      for (const sel of SEL_REVIEW_CARD) {
        const count = await page.$$eval(sel, els => els.length).catch(() => 0);
        if (count > 0) { containerSel = sel; break; }
      }
      if (!containerSel) containerSel = SEL_REVIEW_CARD[SEL_REVIEW_CARD.length - 1];

      const cards = await page.$$(containerSel);
      if (DEBUG) console.log(`page ${p}: ${cards.length} cards`);

      for (const card of cards) {
        const box = await card.boundingBox();
        if (box) await humanScrollTo(page, Math.max(0, box.y - 150));
        await humanPause(200, 500);

        const data = await extractReviewCard(card);
        data._page = p;

        // Try like/helpful counts if present (non-critical)
        try {
          const helpful = await card.locator('button:has-text("Helpful")').first().innerText().catch(()=> '');
          data.helpfulRaw = helpful || '';
          data.helpfulNumeric = convertAbbrevNumber(helpful || '');
        } catch {}
        allReviews.push(data);

        await humanPause(500, 900);
        try { await card.dispose(); } catch {}
      }

      await humanPause(900, 1500);
    }

    // 3) Persist storage state (if any cookies worth keeping)
    try { await context.storageState({ path: storageStatePath }); } catch {}

    // Transform data to match expected format for competitor analysis
    const transformedReviews = allReviews.map(review => ({
      text: `${review.title} ${review.body} ${review.pros} ${review.cons}`.trim(),
      dateRaw: review.dateISO,
      dateISO: review.dateISO,
      likesRaw: '0',
      likesNumeric: 0,
      commentsRaw: '0',
      commentsNumeric: 0,
      sharesRaw: '0',
      sharesNumeric: 0,
      mediaType: 'Unknown',
      mediaLink: '',
      comments: [],
      // G2-specific fields
      rating: review.rating,
      author: review.author,
      pros: review.pros,
      cons: review.cons,
      helpful: review.helpfulNumeric || 0
    }));

    const result = {
      scraped_at: new Date().toISOString(),
      source: reviewsUrl,
      product_page: baseUrl,
      product: productMeta,
      reviews_count: transformedReviews.length,
      reviews: transformedReviews
    };

    return transformedReviews; // Return in format expected by competitor analysis
  } finally {
    try { await page.close(); } catch {}
    try { await context.close(); } catch {}
    try { await browser.close(); } catch {}
  }
}

// ----------------- CLI entry -----------------
async function run() {
  try {
    const res = await scrapeG2(PRODUCT_SLUG);
    console.log('Total reviews:', res.length);
    
    // Save results for standalone usage
    const stamp = dfFormat(new Date(), 'yyyy-MM-dd_HH-mm-ss');
    const baseName = `g2_${PRODUCT_SLUG}_${stamp}`;
    
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    
    fs.writeFileSync(path.join(dataDir, `${baseName}.json`), JSON.stringify(res, null, 2));
    console.log(`✅ Saved to data/${baseName}.json`);
  } catch (err) {
    console.error('Scraping failed:', err);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  run();
}