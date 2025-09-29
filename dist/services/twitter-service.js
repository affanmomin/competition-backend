"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TwitterConfigSchema = void 0;
const zod_1 = require("zod");
const path_1 = __importDefault(require("path"));
// Zod schemas for validation
exports.TwitterConfigSchema = zod_1.z.object({
    username: zod_1.z.string(),
    password: zod_1.z.string(),
    targetProfile: zod_1.z.string(),
    tweetLimit: zod_1.z.number().default(20),
    commentLimit: zod_1.z.number().default(20),
    outputDir: zod_1.z.string().default(path_1.default.join(process.cwd(), "tmp")),
});
