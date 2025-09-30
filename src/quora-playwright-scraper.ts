import { chromium, Page } from "playwright";
import winston from "winston";
import fs from "fs";
import path from "path";

const MAX_RETRIES = 3;

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }: any) => {
      return `${timestamp} [${String(level).toUpperCase()}]: ${message}`;
    }),
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "quora-scraper.log" }),
  ],
});

type AnswersInput = { title?: string; answer?: string };

class AnswersData {
  title: string;
  answer: string;
  constructor(data: AnswersInput = {}) {
    this.title = this.validateAuthor(data.title);
    this.answer = this.validateAnswer(data.answer);
  }

  validateAuthor(author?: string): string {
    if (typeof author === "string" && author.trim() !== "") {
      return author.trim();
    }
    return "No author";
  }

  validateAnswer(answer?: string): string {
    if (typeof answer === "string" && answer.trim() !== "") {
      return answer.trim();
    }
    return "No answer";
  }
}

class DataPipeline {
  private namesSeen: Set<string> = new Set();
  private storageQueue: AnswersData[] = [];
  private storageQueueLimit: number;
  private csvFilename: string;

  constructor(csvFilename: string, storageQueueLimit = 50) {
    this.storageQueueLimit = storageQueueLimit;
    this.csvFilename = csvFilename;
  }

  private ensureHeaderIfNeeded(fields: string[]) {
    const filePath = path.resolve(this.csvFilename);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, fields.join(",") + "\n", "utf8");
    }
  }

  async saveToCsv() {
    const filePath = path.resolve(this.csvFilename);
    const dataToSave = this.storageQueue.splice(0, this.storageQueue.length);
    if (dataToSave.length === 0) return;

    // Ensure header exists once
    this.ensureHeaderIfNeeded(["title", "answer"]);

    const csvLines = dataToSave
      .map(
        (row) => `${this.escapeCsv(row.title)},${this.escapeCsv(row.answer)}`,
      )
      .join("\n");
    fs.appendFileSync(filePath, csvLines + "\n", "utf8");
  }

  private escapeCsv(value: string): string {
    // Escape double quotes and wrap in quotes if needed
    const mustQuote = /[",\n]/.test(value);
    let v = value.replace(/"/g, '""');
    if (mustQuote) v = `"${v}"`;
    return v;
  }

  isDuplicate(title: string) {
    if (this.namesSeen.has(title)) {
      logger.warn(`Duplicate item found: ${title}. Item dropped.`);
      return true;
    }
    this.namesSeen.add(title);
    return false;
  }

  async addData(data: AnswersData) {
    if (!this.isDuplicate(data.title)) {
      this.storageQueue.push(data);
      if (this.storageQueue.length >= this.storageQueueLimit) {
        await this.saveToCsv();
      }
    }
  }

  async closePipeline() {
    if (this.storageQueue.length > 0) await this.saveToCsv();
  }
}

async function autoScroll(page: Page) {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= document.body.scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}

async function scrapeAnswersData(
  dataPipeline: DataPipeline,
  url: string,
  retries = MAX_RETRIES,
) {
  const browser = await chromium.launch({
    headless: false,
    proxy: {
      server: "http://gw.dataimpulse.com:823",
      username: "2cef711aaa1a060b00b2",
      password: "71e56626760e1077",
    },
  });
  let totalAnswers = 0;
  const context = await browser.newContext();
  const page = await context.newPage();

  while (retries > 0) {
    try {
      logger.info(`Attempting to scrape ${url}, Retries left: ${retries}`);
      await page.goto(url, { waitUntil: "networkidle" });

      // Open the sort dropdown and select "All time" if available (similar to original code)
      await page.waitForSelector(
        'button[aria-haspopup="menu"][role="button"]',
        { state: "attached", timeout: 15000 },
      );
      await page.click('button[aria-haspopup="menu"][role="button"]');
      await page.waitForSelector(".puppeteer_test_popover_menu", {
        timeout: 10000,
      });
      const options = await page.$$(
        ".q-click-wrapper.puppeteer_test_popover_item",
      );
      if (options.length > 1) {
        await options[1].click();
      }

      await autoScroll(page);

      const answers = await page.evaluate(() => {
        const answerElements = document.querySelectorAll(
          '[class^="q-box dom_annotate_question_answer_item_"]',
        );
        return Array.from(answerElements).map((answer) => {
          const readMoreButton = answer.querySelector(
            "button.puppeteer_test_read_more_button",
          ) as HTMLButtonElement | null;
          if (readMoreButton) {
            readMoreButton.click();
          }
          const authorName = answer.querySelector(
            ".q-box.spacing_log_answer_header",
          ) as HTMLElement | null;
          const authorNameText = authorName
            ? authorName.innerText.split("\n")[0]
            : "Unknown Author";
          const contentEl = answer.querySelector(
            ".q-box.spacing_log_answer_content.puppeteer_test_answer_content",
          ) as HTMLElement | null;
          const authorAnswer = contentEl?.innerText ?? "";
          return { title: authorNameText, answer: authorAnswer };
        });
      });

      totalAnswers = answers.length;
      for (const ans of answers) {
        await dataPipeline.addData(new AnswersData(ans));
      }

      break;
    } catch (error: any) {
      logger.error(
        `Error scraping ${url}. Retries left: ${retries}. Error: ${error?.message || error}`,
      );
      retries--;
      if (retries > 0) {
        await page.waitForTimeout(2000);
      } else {
        logger.error(`Failed to scrape ${url} after multiple retries.`);
      }
    }
  }

  logger.info(`Successfully Scraped ${totalAnswers} Answers for ${url}`);
  await browser.close();
}

async function main() {
  logger.info("Started Scraping Search Results");

  // Hard-coded URL per request. You can replace this with your target question URL.
  const url =
    "https://www.quora.com/What-is-ClickUp-software-and-how-can-it-help-you-manage-your-projects";

  const fileSuffix = url.match(/([^/]+)$/)?.[1] ?? "results";
  const dataPipeline = new DataPipeline(`${fileSuffix}-Answers.csv`);
  await scrapeAnswersData(dataPipeline, url);
  await dataPipeline.closePipeline();
}

// main().catch((e) => {
//   logger.error(`Fatal error: ${e?.message || e}`);
//   process.exitCode = 1;
// });
