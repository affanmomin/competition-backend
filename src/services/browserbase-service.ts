// import { Browser } from "playwright-core";
// import { chromium } from "playwright-core";
// import Browserbase from "@browserbasehq/sdk";
// import dotenv from "dotenv";

// // Load environment variables
// dotenv.config();

// export class BrowserbaseService {
//   private static instance: BrowserbaseService;
//   private readonly bb: Browserbase | null = null;

//   private constructor() {
//     const apiKey = process.env.BROWSERBASE_API_KEY;
//     if (apiKey) {
//       this.bb = new Browserbase({ apiKey });
//     }
//   }

//   public static getInstance(): BrowserbaseService {
//     if (!BrowserbaseService.instance) {
//       BrowserbaseService.instance = new BrowserbaseService();
//     }
//     return BrowserbaseService.instance;
//   }

//   public async createSession(): Promise<Browser> {
//     if (this.bb && process.env.BROWSERBASE_PROJECT_ID) {
//       // Create a new browserbase session
//       const session = await this.bb.sessions.create({
//         projectId: process.env.BROWSERBASE_PROJECT_ID
//           // proxies: [
//           //   {
//           //     type: "external",
//           //     server: "http://64.137.96.74:8080",  // Make sure to use your correct port
//           //     username: "lvqdtkgb",
//           //     password: "7e8435a7on1i"
//           //   }
//           // ]
//       });

//       console.log("Created new BrowserBase session:", session.id);

//       // Connect to the session
//       const browser = await chromium.connectOverCDP(session.connectUrl);
//       console.log("Connected to browser session");

//       return browser;
//     }

//     return chromium.launch({ headless: true });
//   }
// }
