import { Browser, BrowserContext, Page } from "playwright-core";
import { z } from "zod";
import path from "path";
import fs from "fs";
import { BrowserbaseService } from "./browserbase-service";

// Zod schemas for validation
export const TwitterConfigSchema = z.object({
  username: z.string(),
  password: z.string(),
  targetProfile: z.string(),
  tweetLimit: z.number().default(20),
  commentLimit: z.number().default(20),
  outputDir: z.string().default(path.join(process.cwd(), "tmp"))
});

export type TwitterConfig = z.infer<typeof TwitterConfigSchema>;

export interface TweetData {
  url: string;
  Tweet: string;
  Likes: string;
  Comments: string[];
}

export class TwitterService {
  private readonly config: TwitterConfig;
  private readonly browserbaseService: BrowserbaseService;

  constructor(config: TwitterConfig) {
    this.config = TwitterConfigSchema.parse(config);
    this.ensureOutputDirectory();
    this.browserbaseService = BrowserbaseService.getInstance();
  }

  private ensureOutputDirectory(): void {
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
    }
  }

  private extractDigits(text: string | null): string {
    if (!text) return "0";
    const m = text.replace(/\u00A0/g, " ").match(/[\d,]+/);
    return m ? m[0].replace(/,/g, "") : "0";
  }

  async login(page: Page): Promise<void> {
    await page.goto("https://twitter.com/login");
    await page.fill('input[name="text"]', this.config.username);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1000);
    await page.fill('input[name="password"]', this.config.password);
    await page.keyboard.press("Enter");
    await page.waitForSelector('input[aria-label="Search query"]', { timeout: 20000 });
  }

  async collectTweetUrls(page: Page): Promise<Array<{ url: string; likes: string }>> {
    const tweets: Array<{ url: string; likes: string }> = [];
    const seen = new Set<string>();

    while (tweets.length < this.config.tweetLimit) {
      const articles = await page.$$('article[role="article"]');
      for (const article of articles) {
        if (tweets.length >= this.config.tweetLimit) break;

        const anchor = await article.$('a[href*="/status/"]');
        if (!anchor) continue;
        let href = await anchor.getAttribute("href");
        if (!href) continue;
        if (!href.startsWith("http")) href = new URL(href, "https://twitter.com").href;
        if (seen.has(href)) continue;

        seen.add(href);

        let likes = "0";
        try {
          const likeBtn = await article.$('div[data-testid="like"]');
          if (likeBtn) {
            const label = await likeBtn.getAttribute("aria-label");
            likes = this.extractDigits(label);
          }
        } catch {
          // Ignore like button errors
        }

        tweets.push({ url: href, likes });
      }

      if (tweets.length < this.config.tweetLimit) {
        await page.evaluate(() => window.scrollBy(0, window.innerHeight));
        await page.waitForTimeout(1500);
      }
    }

    return tweets.slice(0, this.config.tweetLimit);
  }

  async scrapeTweetPage(context: BrowserContext, tweetObj: { url: string; likes: string }): Promise<TweetData> {
    const page = await context.newPage();
    await page.goto(tweetObj.url, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('article[role="article"]', { timeout: 15000 });

    const mainArticle = await page.locator('article[role="article"]').first();
    const mainTweet = (await mainArticle.innerText()).trim();

    const comments: string[] = [];
    const collectComments = async () => {
      const articles = await page.$$('article[role="article"]');
      for (let i = 1; i < articles.length && comments.length < this.config.commentLimit; i++) {
        const txt = (await articles[i].innerText()).trim();
        if (txt && !comments.includes(txt)) {
          comments.push(txt);
        }
      }
    };

    await collectComments();
    let scrolls = 0;
    while (comments.length < this.config.commentLimit && scrolls < 10) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await page.waitForTimeout(1200);
      await collectComments();
      scrolls++;
    }

    await page.close();
    return {
      url: tweetObj.url,
      Tweet: mainTweet,
      Likes: tweetObj.likes,
      Comments: comments
    };
  }

  async scrapeTweets(): Promise<TweetData[]> {
    const browser = await this.browserbaseService.createSession();
    try {
      const context = browser.contexts()[0];
      const page = await context.newPage();

      await this.login(page);

      await page.goto(`https://twitter.com/${this.config.targetProfile}`);
      await page.waitForSelector('article[role="article"]');

      const tweetObjs = await this.collectTweetUrls(page);

      const results: TweetData[] = [];
      for (let i = 0; i < tweetObjs.length; i++) {
        console.log(`Scraping ${i + 1}/${tweetObjs.length}: ${tweetObjs[i].url}`);
        const data = await this.scrapeTweetPage(context, tweetObjs[i]);
        results.push(data);
        await page.waitForTimeout(1000);
      }

      const outputPath = path.join(this.config.outputDir, "tweets_with_comments.json");
      fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
      console.log(`✅ Saved to ${outputPath}`);

      return results;
    } finally {
      await browser.close();
    }
  }
}
