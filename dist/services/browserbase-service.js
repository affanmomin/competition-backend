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
exports.BrowserbaseService = void 0;
const playwright_core_1 = require("playwright-core");
const sdk_1 = __importDefault(require("@browserbasehq/sdk"));
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
class BrowserbaseService {
    constructor() {
        this.bb = null;
        const apiKey = process.env.BROWSERBASE_API_KEY;
        if (apiKey) {
            this.bb = new sdk_1.default({ apiKey });
        }
    }
    static getInstance() {
        if (!BrowserbaseService.instance) {
            BrowserbaseService.instance = new BrowserbaseService();
        }
        return BrowserbaseService.instance;
    }
    createSession() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.bb && process.env.BROWSERBASE_PROJECT_ID) {
                // Create a new browserbase session
                const session = yield this.bb.sessions.create({
                    projectId: process.env.BROWSERBASE_PROJECT_ID
                    // proxies: [
                    //   {
                    //     type: "external",
                    //     server: "http://64.137.96.74:8080",  // Make sure to use your correct port
                    //     username: "lvqdtkgb",
                    //     password: "7e8435a7on1i"
                    //   }
                    // ]
                });
                console.log("Created new BrowserBase session:", session.id);
                // Connect to the session
                const browser = yield playwright_core_1.chromium.connectOverCDP(session.connectUrl);
                console.log("Connected to browser session");
                return browser;
            }
            return playwright_core_1.chromium.launch({ headless: true });
        });
    }
}
exports.BrowserbaseService = BrowserbaseService;
