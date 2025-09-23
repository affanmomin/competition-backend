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
const zod_1 = require("zod");
const path_1 = __importDefault(require("path"));
const twitter_service_1 = require("../services/twitter-service");
const twitterRoutes = (fastify) => __awaiter(void 0, void 0, void 0, function* () {
    // Schema for request body validation
    const ScrapeRequestSchema = twitter_service_1.TwitterConfigSchema.omit({
        outputDir: true
    }).extend({
        outputDir: zod_1.z.string().optional()
    });
    fastify.post("/scrape", {
        schema: {
            body: {
                type: "object",
                required: ["username", "password", "targetProfile"],
                properties: {
                    username: { type: "string" },
                    password: { type: "string" },
                    targetProfile: { type: "string" },
                    tweetLimit: { type: "number", default: 20 },
                    commentLimit: { type: "number", default: 20 },
                    outputDir: { type: "string" }
                }
            }
        }
    }, (request, reply) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        try {
            const config = Object.assign(Object.assign({}, request.body), { outputDir: (_a = request.body.outputDir) !== null && _a !== void 0 ? _a : path_1.default.join(process.cwd(), "tmp") });
            const twitterService = new twitter_service_1.TwitterService(config);
            const results = yield twitterService.scrapeTweets();
            return { success: true, data: results };
        }
        catch (error) {
            fastify.log.error(error);
            if (error instanceof zod_1.z.ZodError) {
                return reply.status(400).send({
                    success: false,
                    error: "Invalid request data",
                    details: error.errors
                });
            }
            return reply.status(500).send({
                success: false,
                error: "Failed to scrape tweets"
            });
        }
    }));
});
exports.default = twitterRoutes;
