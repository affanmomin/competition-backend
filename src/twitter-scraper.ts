// @ts-nocheck
/**
 * twitter-scraper.ts
 * Scrapes Twitter profile posts + comments with human-like behaviour.
 * Usage: npx tsx src/twitter-scraper.ts
 * IMPORTANT: Respect Twitter's Terms of Service.
 */

import { chromium, Page, ElementHandle, BrowserContext, Browser } from 'playwright';
import * as fs from 'fs-extra';
import * as path from 'path';
import { format as csvFormat } from '@fast-csv/format';
import { subDays, subWeeks, subMonths, subYears, format as dfFormat } from 'date-fns';

// ----------------- CONFIG -----------------
const TWITTER_USER = process.env.TWITTER_USER || "chanda_adn50636";
const TWITTER_PASS = process.env.TWITTER_PASS || "Dev@1234";
const loginUrl = "https://twitter.com/login";

const DEBUG = true;

const INCLUDE_COMMENTS = true;
const MAX_COMMENT_PAGES = 5;        // how many times to scroll to load more comments
const MAX_COMMENTS_PER_POST = 100;  // hard cap per post
const TWEET_LIMIT = 5;              // number of tweets to scrape
const PARALLEL_LIMIT = 2;           // number of tweet pages to scrape in parallel

const STORAGE_STATE_PATH = path.resolve(process.cwd(), 'twitter-session.json'); // <- session file

// ----------------- Derived file names -----------------
function generateTwitterNames(profileHandle: string) {
  const profile_slug = profileHandle.replace('@', '').toLowerCase();
  const profileNameTitle = profile_slug.replace(/\b\w/g, c => c.toUpperCase());
  
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
const SEL_TWEET_TEXT = 'div[lang]';
const SEL_TWEET_LINK = 'a[href*="/status/"]';
const SEL_TWEET_TIME = 'time';

// Engagement selectors
const SEL_LIKE_BUTTON = 'div[data-testid="like"]';
const SEL_RETWEET_BUTTON = 'div[data-testid="retweet"]';
const SEL_REPLY_BUTTON = 'div[data-testid="reply"]';

// Comment/Reply selectors
const SEL_USERNAME = 'div[data-testid="User-Name"] span';

// ----------------- Human-like utilities -----------------
function rand(min: number, max: number) { 
  return Math.floor(Math.random() * (max - min + 1)) + min; 
}

async function pause(min = 140, max = 320) {
  await new Promise(r => setTimeout(r, rand(min, max)));
}   

async function humanScroll(page: Page, factor = 3) {
  const segments = rand(3, 6);
  for (let i = 0; i < segments; i++) {
    await page.evaluate((segments) => {
      const winH = window.innerHeight;
      const delta = Math.floor(winH / segments) + Math.floor(Math.random() * 30);
      window.scrollBy(0, delta);
    }, segments);
    await pause(120, 280);
  }
}

async function slowTypeInto(page: Page, selector: string, text: string) {
  const loc = page.locator(selector);
  await loc.click({ timeout: 15000 });
  await page.keyboard.type(text, { delay: rand(70, 120) });
}

// ----------------- Stealth context (supports storageState reuse) -----------------
async function makeStealthyContext(browser: Browser, storageStatePath?: string): Promise<BrowserContext> {
  const contextOpts: any = {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    viewport: { width: 1280, height: 720 }
  };

  if (storageStatePath && fs.existsSync(storageStatePath)) {
    contextOpts.storageState = storageStatePath;
    if (DEBUG) console.log('Using saved storageState:', storageStatePath);
  }

  const context = await browser.newContext(contextOpts);

  // Block unnecessary resources
  await context.route('**/*', route => {
    const type = route.request().resourceType();
    if (['font', 'media'].includes(type)) route.abort();
    else route.continue();
  });

  return context;
}

// ----------------- Session management -----------------
async function saveSession(context: BrowserContext) {
  const page = await context.newPage();
  await page.goto('https://twitter.com', { waitUntil: 'load' });

  const cookies = await context.cookies();
  const localStorage = await page.evaluate(() => {
    const store: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) store[key] = localStorage.getItem(key) || '';
    }
    return store;
  });

  fs.writeFileSync(STORAGE_STATE_PATH, JSON.stringify({ cookies, localStorage }, null, 2));
  await page.close();
  console.log('💾 Session saved');
}

async function loadSession(context: BrowserContext): Promise<boolean> {
  if (!fs.existsSync(STORAGE_STATE_PATH)) return false;

  try {
    const sessionData = JSON.parse(fs.readFileSync(STORAGE_STATE_PATH, 'utf-8'));
    await context.addCookies(sessionData.cookies);

    const page = await context.newPage();
    await page.goto('https://twitter.com', { waitUntil: 'domcontentloaded' });

    await page.evaluate((data) => {
      for (const key in data) {
        localStorage.setItem(key, data[key]);
      }
    }, sessionData.localStorage);

    await page.close();
    console.log('🔁 Session loaded');
    return true;
  } catch (err: any) {
    console.warn('⚠️ Could not load session:', err.message);
    return false;
  }
}

// ----------------- Login function -----------------
async function login(page: Page) {
  try {
    console.log('🔐 Logging in...');
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

    await page.waitForSelector(SEL_USER, { timeout: 20000 });
    await pause(200, 400);
    await slowTypeInto(page, SEL_USER, TWITTER_USER);
    await pause(160, 260);
    await page.keyboard.press("Enter");

    await page.waitForSelector(SEL_PASS, { timeout: 15000 });
    await pause(240, 460);
    await slowTypeInto(page, SEL_PASS, TWITTER_PASS);
    await pause(160, 300);
    await page.keyboard.press("Enter");

    await Promise.race([
      page.waitForSelector('input[aria-label="Search query"]', { timeout: 30000 }),
      page.waitForURL('**/home', { timeout: 30000 })
    ]);

    console.log('✅ Logged in successfully');
  } catch (error: any) {
    throw new Error(`Login failed: ${error.message}`);
  }
}

// ----------------- Engagement parsing utilities -----------------
function extractDigits(text: string): string {
  if (!text) return "0";
  const t = text.replace(/\u00A0/g, ' ').trim();
  const mMatch = t.match(/(\d+(?:\.\d+)?)\s*[Mm]/);
  const kMatch = t.match(/(\d+(?:\.\d+)?)\s*[Kk]/);
  if (mMatch) return String(Math.round(parseFloat(mMatch[1]) * 1_000_000));
  if (kMatch) return String(Math.round(parseFloat(kMatch[1]) * 1_000));
  const plain = t.match(/[\d,.]+/);
  return plain ? plain[0].replace(/[.,](?=\d{3}\b)/g, '') : "0";
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

// ----------------- Tweet collection functions -----------------
async function collectTweetUrls(page: Page, limit: number): Promise<{ url: string; likes: string }[]> {
  const tweets: { url: string; likes: string }[] = [];
  const seen = new Set<string>();
  let scrollAttempts = 0;

  while (tweets.length < limit && scrollAttempts < 6) {
    const articles = await page.$$(SEL_TWEET_CONTAINER);

    await Promise.all(articles.map(async (article) => {
      if (tweets.length >= limit) return;
      try {
        const anchor = await article.$(SEL_TWEET_LINK);
        if (!anchor) return;
        
        let href = await anchor.getAttribute('href');
        if (!href || seen.has(href)) return;
        if (!href.startsWith('http')) href = new URL(href, 'https://twitter.com').href;
        seen.add(href);

        let likes = "0";
        try {
          const likeAction = await article.$(SEL_LIKE_BUTTON);
          if (likeAction) {
            const countText = await likeAction.evaluate((node) => {
              const group = node.closest('div[role="group"]') || node.parentElement;
              if (group) {
                const candidates = group.querySelectorAll('span, div');
                for (const c of candidates) {
                  const txt = (c.textContent || '').trim();
                  if (/^\d[\d,.\sKkMm]*$/.test(txt)) return txt;
                }
              }
              return node.getAttribute('aria-label') || '';
            });
            likes = extractDigits(countText || "");
          }
        } catch { }

        tweets.push({ url: href, likes });
      } catch { }
    }));

    if (tweets.length < limit) {
      await humanScroll(page, 3);
      scrollAttempts++;
    }
  }

  return tweets.slice(0, limit);
}

// ----------------- Tweet page scraping -----------------
async function scrapeTweetPage(context: BrowserContext, tweetObj: { url: string; likes: string }, index: number) {
  const page = await context.newPage();
  try {
    await page.goto(tweetObj.url, { timeout: 25000 });
    await pause(180, 360);

    let mainTweet = 'Could not load tweet';
    try {
      await page.waitForSelector('article[data-testid="tweet"] div[lang], article[role="article"] div[lang]', { timeout: 8000 });
      mainTweet = await page.$eval('article[data-testid="tweet"] div[lang], article[role="article"] div[lang]', el => el.innerText.trim());
    } catch { }

    const commentMap = new Map<string, { username: string; comment: string }>();
    let scrollCount = 0;
    let noNewCount = 0;

    while (commentMap.size < MAX_COMMENTS_PER_POST && scrollCount < MAX_COMMENT_PAGES && noNewCount < 2) {
      const before = commentMap.size;
      const articles = await page.$$('article[data-testid="tweet"], article[role="article"]');

      for (let i = 1; i < Math.min(articles.length, 40); i++) {
        try {
          const username = await articles[i].$eval('div[data-testid="User-Name"] span', el => el.innerText.trim()).catch(() => "");
          const commentText = await articles[i].$eval('div[lang]', el => el.innerText.trim()).catch(() => "");
          if (commentText) {
            const key = username + '|' + commentText;
            if (!commentMap.has(key)) commentMap.set(key, { username, comment: commentText });
          }
        } catch { }
      }

      if (commentMap.size === before) noNewCount++;
      else noNewCount = 0;

      if (commentMap.size < MAX_COMMENTS_PER_POST && scrollCount < MAX_COMMENT_PAGES) {
        await humanScroll(page, 5);
        await pause(260, 520);
        scrollCount++;
      }
    }

    return {
      url: tweetObj.url,
      Post: mainTweet.trim(),
      Likes: tweetObj.likes,
      Comments: Array.from(commentMap.values()).slice(0, MAX_COMMENTS_PER_POST)
    };
  } catch (error) {
    return {
      url: tweetObj.url,
      Post: 'Error loading tweet',
      Likes: tweetObj.likes,
      Comments: []
    };
  } finally {
    await page.close();
  }
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

// ----------------- Main Scraping Function -----------------
export async function scrapeTwitterPosts(profileHandle: string): Promise<any[]> {
  const { profileUrl, profileNameTitle } = generateTwitterNames(profileHandle);
  
  const browser = await chromium.launch({
    headless: false,
    slowMo: 50,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ],
    proxy:{
      server: 'http://gw.dataimpulse.com:823',
      username: '2cef711aaa1a060b00b2',
      password: '71e56626760e1077'  
    }
  });

  const context = await makeStealthyContext(browser, fs.existsSync(STORAGE_STATE_PATH) ? STORAGE_STATE_PATH : undefined);

  try {
    let sessionLoaded = await loadSession(context);
    const page = await context.newPage();

    if (sessionLoaded) {
      try {
        await page.goto('https://twitter.com/home', { waitUntil: 'domcontentloaded', timeout: 20000 });
        const currentURL = page.url();
        if (currentURL.includes("/login")) {
          console.log("❌ Session invalid. Re-authenticating...");
          sessionLoaded = false;
        } else {
          console.log("✅ Session valid. Skipping login.");
        }
      } catch {
        console.log("⚠️ Session validation failed. Re-authenticating...");
        sessionLoaded = false;
      }
    }

    if (!sessionLoaded) {
      await login(page);
      await saveSession(context);
    }

    // Navigate to profile
    await page.goto(profileUrl, {timeout: 25000 });
    await page.waitForSelector('article[role="article"], article[data-testid="tweet"]', { timeout: 15000 });

    // Collect tweet URLs
    const tweetObjs = await collectTweetUrls(page, TWEET_LIMIT);
    const results: any[] = [];

    // Scrape tweets in parallel batches
    for (let i = 0; i < tweetObjs.length; i += PARALLEL_LIMIT) {
      const batch = tweetObjs.slice(i, i + PARALLEL_LIMIT);
      const batchResults = await Promise.all(batch.map((t, j) => scrapeTweetPage(context, t, i + j + 1)));
      results.push(...batchResults);
      if (i + PARALLEL_LIMIT < tweetObjs.length) await pause(800, 1200);
    }
    
    return results;
  } catch (error: any) {
    console.error('❌ Twitter scraping failed:', error.message);
    throw error;
  } finally {
    try { await context.close(); } catch {}
    try { await browser.close(); } catch {}
  }
}

// ----------------- Legacy Main Function (for backwards compatibility) -----------------
async function run() {
  const profileHandle = "google"; // Default profile for legacy usage
  
  try {
    const results = await scrapeTwitterPosts(profileHandle);
    
    // Export results - match original output format
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    
    fs.writeFileSync(path.join(dataDir, "tweets_with_comments.json"), JSON.stringify(results, null, 2));
    console.log(`✅ Saved to data/tweets_with_comments.json`);
  } catch (error) {
    console.error('❌ SCRIPT FAILED:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  run();
}