// @ts-nocheck
/**
 * g2-scraper-stealth.ts (simplified)
 * Opens Google, searches "G2", waits 60 seconds.
 *
 * Usage:
 *   npx tsx src/g2-scraper-stealth.ts
 */

import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://www.g2.com', {timeout: 60000 });

  await page.waitForTimeout(60000);

  await browser.close();
}

if (require.main === module) {
  run().catch((err) => {
    console.error('Failed:', err);
    process.exit(1);
  });
}
