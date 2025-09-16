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
Object.defineProperty(exports, "__esModule", { value: true });
exports.performGoogleSearch = performGoogleSearch;
const playwright_core_1 = require("playwright-core");
function performGoogleSearch(searchQuery) {
    return __awaiter(this, void 0, void 0, function* () {
        const browser = yield playwright_core_1.chromium.launch({ headless: false });
        const results = [];
        try {
            const context = yield browser.newContext();
            const page = yield context.newPage();
            // Navigate to Google
            yield page.goto("https://www.google.com");
            // Type into search box
            yield page.fill('textarea[name="q"]', searchQuery);
            // Press enter
            yield page.press('textarea[name="q"]', "Enter");
            // Wait for search results
            yield page.waitForSelector('div[id="search"]');
            // Extract first 5 search results
            const searchResults = yield page.$$('div[class*="g"]');
            for (let i = 0; i < Math.min(5, searchResults.length); i++) {
                const result = searchResults[i];
                const titleElement = yield result.$('h3');
                const linkElement = yield result.$('a');
                const descElement = yield result.$('div[class*="VwiC3b"]');
                if (titleElement && linkElement) {
                    const title = (yield titleElement.textContent()) || '';
                    const url = (yield linkElement.getAttribute('href')) || '';
                    const description = (yield (descElement === null || descElement === void 0 ? void 0 : descElement.textContent())) || '';
                    results.push({
                        title: title.trim(),
                        url: url.trim(),
                        description: description.trim()
                    });
                }
            }
            return results;
        }
        finally {
            yield browser.close();
        }
    });
}
