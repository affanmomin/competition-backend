import { chromium } from "playwright-core";

export interface SearchResult {
  title: string;
  url: string;
  description: string;
}

export async function performGoogleSearch(searchQuery: string): Promise<SearchResult[]> {
  const browser = await chromium.launch({ headless: false });
  const results: SearchResult[] = [];

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Navigate to Google
    await page.goto("https://www.google.com");

    // Type into search box
    await page.fill('textarea[name="q"]', searchQuery);

    // Press enter
    await page.press('textarea[name="q"]', "Enter");

    // Wait for search results
    await page.waitForSelector('div[id="search"]');

    // Extract first 5 search results
    const searchResults = await page.$$('div[class*="g"]');

    for (let i = 0; i < Math.min(5, searchResults.length); i++) {
      const result = searchResults[i];

      const titleElement = await result.$('h3');
      const linkElement = await result.$('a');
      const descElement = await result.$('div[class*="VwiC3b"]');

      if (titleElement && linkElement) {
        const title = await titleElement.textContent() || '';
        const url = await linkElement.getAttribute('href') || '';
        const description = await descElement?.textContent() || '';

        results.push({
          title: title.trim(),
          url: url.trim(),
          description: description.trim()
        });
      }
    }

    return results;
  } finally {
    await browser.close();
  }
}
