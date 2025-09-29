"use strict";
// @ts-nocheck
/**
 * g2-scraper-stealth.ts (simplified)
 * Opens Google, searches "G2", waits 60 seconds.
 *
 * Usage:
 *   npx tsx src/g2-scraper-stealth.ts
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const playwright_1 = require("playwright");
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        const browser = yield playwright_1.chromium.launch({ headless: false });
        const context = yield browser.newContext();
        const page = yield context.newPage();
        yield page.goto("https://www.linkedinflow.com", { timeout: 60000 });
        yield page.waitForTimeout(60000);
        yield browser.close();
    });
}
if (require.main === module) {
    run().catch((err) => {
        console.error("Failed:", err);
        process.exit(1);
    });
}
