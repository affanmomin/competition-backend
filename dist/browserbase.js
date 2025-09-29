"use strict";
// import { chromium } from "playwright-core";
// import Browserbase from "@browserbasehq/sdk";
// import dotenv from "dotenv";
// // Load environment variables
// dotenv.config();
// if (!process.env.BROWSERBASE_API_KEY || !process.env.BROWSERBASE_PROJECT_ID) {
//   throw new Error("BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID must be set in .env file");
// }
// const bb = new Browserbase({
//   apiKey: process.env.BROWSERBASE_API_KEY
// });
// (async () => {
//   try {
//     // Create a new session
//     const session = await bb.sessions.create({
//       projectId: process.env.BROWSERBASE_PROJECT_ID as string
//     });
//     console.log("Created new BrowserBase session:", session.id);
//     // Connect to the session
//     const browser = await chromium.connectOverCDP(session.connectUrl);
//     console.log("Connected to browser session");
//     // Getting the default context to ensure the sessions are recorded
//     const defaultContext = browser.contexts()[0];
//     const page = defaultContext.pages()[0];
//     console.log("Navigating to Hacker News...");
//     await page.goto("https://news.ycombinator.com/");
//     // Add a small delay to ensure the page is captured
//     await page.waitForTimeout(2000);
//     await page.close();
//     await browser.close();
//     console.log(`Session complete! View replay at https://browserbase.com/sessions/${session.id}`);
//   } catch (error) {
//     if (error instanceof Error) {
//       console.error("Error occurred:", error.message);
//     } else {
//       console.error("An unknown error occurred:", error);
//     }
//     process.exit(1);
//   }
// })();
