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
const playwright_core_1 = require("playwright-core");
const sdk_1 = __importDefault(require("@browserbasehq/sdk"));
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
if (!process.env.BROWSERBASE_API_KEY || !process.env.BROWSERBASE_PROJECT_ID) {
    throw new Error("BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID must be set in .env file");
}
const bb = new sdk_1.default({
    apiKey: process.env.BROWSERBASE_API_KEY
});
(() => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Create a new session
        const session = yield bb.sessions.create({
            projectId: process.env.BROWSERBASE_PROJECT_ID
        });
        console.log("Created new BrowserBase session:", session.id);
        // Connect to the session
        const browser = yield playwright_core_1.chromium.connectOverCDP(session.connectUrl);
        console.log("Connected to browser session");
        // Getting the default context to ensure the sessions are recorded
        const defaultContext = browser.contexts()[0];
        const page = defaultContext.pages()[0];
        console.log("Navigating to Hacker News...");
        yield page.goto("https://news.ycombinator.com/");
        // Add a small delay to ensure the page is captured
        yield page.waitForTimeout(2000);
        yield page.close();
        yield browser.close();
        console.log(`Session complete! View replay at https://browserbase.com/sessions/${session.id}`);
    }
    catch (error) {
        if (error instanceof Error) {
            console.error("Error occurred:", error.message);
        }
        else {
            console.error("An unknown error occurred:", error);
        }
        process.exit(1);
    }
}))();
