"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TwitterService = exports.TwitterConfigSchema = void 0;
const zod_1 = require("zod");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const browserbase_service_1 = require("./browserbase-service");
// Zod schemas for validation
exports.TwitterConfigSchema = zod_1.z.object({
    username: zod_1.z.string(),
    password: zod_1.z.string(),
    targetProfile: zod_1.z.string(),
    tweetLimit: zod_1.z.number().default(20),
    commentLimit: zod_1.z.number().default(20),
    outputDir: zod_1.z.string().default(path_1.default.join(process.cwd(), "tmp"))
});
class TwitterService {
    constructor(config) {
        this.config = exports.TwitterConfigSchema.parse(config);
        this.ensureOutputDirectory();
        this.browserbaseService = browserbase_service_1.BrowserbaseService.getInstance();
    }
    ensureOutputDirectory() {
        if (!fs_1.default.existsSync(this.config.outputDir)) {
            fs_1.default.mkdirSync(this.config.outputDir, { recursive: true });
        }
    }
    extractDigits(text) {
        if (!text)
            return "0";
        const m = text.replace(/\u00A0/g, " ").match(/[\d,]+/);
        return m ? m[0].replace(/,/g, "") : "0";
    }
    login(page) {
        return __awaiter(this, void 0, void 0, function* () {
            yield page.goto("https://twitter.com/login");
            yield page.fill('input[name="text"]', this.config.username);
            yield page.keyboard.press("Enter");
            yield page.waitForTimeout(1000);
            yield page.fill('input[name="password"]', this.config.password);
            yield page.keyboard.press("Enter");
            yield page.waitForSelector('input[aria-label="Search query"]', { timeout: 20000 });
        });
    }
    collectTweetUrls(page) {
        return __awaiter(this, void 0, void 0, function* () {
            const tweets = [];
            const seen = new Set();
            while (tweets.length < this.config.tweetLimit) {
                const articles = yield page.$$('article[role="article"]');
                for (const article of articles) {
                    if (tweets.length >= this.config.tweetLimit)
                        break;
                    const anchor = yield article.$('a[href*="/status/"]');
                    if (!anchor)
                        continue;
                    let href = yield anchor.getAttribute("href");
                    if (!href)
                        continue;
                    if (!href.startsWith("http"))
                        href = new URL(href, "https://twitter.com").href;
                    if (seen.has(href))
                        continue;
                    seen.add(href);
                    let likes = "0";
                    try {
                        const likeBtn = yield article.$('div[data-testid="like"]');
                        if (likeBtn) {
                            const label = yield likeBtn.getAttribute("aria-label");
                            likes = this.extractDigits(label);
                        }
                    }
                    catch (_a) {
                        // Ignore like button errors
                    }
                    tweets.push({ url: href, likes });
                }
                if (tweets.length < this.config.tweetLimit) {
                    yield page.evaluate(() => window.scrollBy(0, window.innerHeight));
                    yield page.waitForTimeout(1500);
                }
            }
            return tweets.slice(0, this.config.tweetLimit);
        });
    }
    scrapeTweetPage(context, tweetObj) {
        return __awaiter(this, void 0, void 0, function* () {
            const page = yield context.newPage();
            yield page.goto(tweetObj.url, { waitUntil: "domcontentloaded" });
            yield page.waitForSelector('article[role="article"]', { timeout: 15000 });
            const mainArticle = yield page.locator('article[role="article"]').first();
            const mainTweet = (yield mainArticle.innerText()).trim();
            const comments = [];
            const collectComments = () => __awaiter(this, void 0, void 0, function* () {
                const articles = yield page.$$('article[role="article"]');
                for (let i = 1; i < articles.length && comments.length < this.config.commentLimit; i++) {
                    const txt = (yield articles[i].innerText()).trim();
                    if (txt && !comments.includes(txt)) {
                        comments.push(txt);
                    }
                }
            });
            yield collectComments();
            let scrolls = 0;
            while (comments.length < this.config.commentLimit && scrolls < 10) {
                yield page.evaluate(() => window.scrollBy(0, window.innerHeight));
                yield page.waitForTimeout(1200);
                yield collectComments();
                scrolls++;
            }
            yield page.close();
            return {
                url: tweetObj.url,
                Tweet: mainTweet,
                Likes: tweetObj.likes,
                Comments: comments
            };
        });
    }
    scrapeTweets() {
        return __awaiter(this, void 0, void 0, function* () {
            const browser = yield this.browserbaseService.createSession();
            try {
                const context = browser.contexts()[0];
                const page = yield context.newPage();
                yield this.login(page);
                yield page.goto(`https://twitter.com/${this.config.targetProfile}`);
                yield page.waitForSelector('article[role="article"]');
                const tweetObjs = yield this.collectTweetUrls(page);
                const results = [];
                for (let i = 0; i < tweetObjs.length; i++) {
                    console.log(`Scraping ${i + 1}/${tweetObjs.length}: ${tweetObjs[i].url}`);
                    const data = yield this.scrapeTweetPage(context, tweetObjs[i]);
                    results.push(data);
                    yield page.waitForTimeout(1000);
                }
                const outputPath = path_1.default.join(this.config.outputDir, "tweets_with_comments.json");
                fs_1.default.writeFileSync(outputPath, JSON.stringify(results, null, 2));
                console.log(`✅ Saved to ${outputPath}`);
                return results;
            }
            finally {
                yield browser.close();
            }
        });
    }
}
exports.TwitterService = TwitterService;
