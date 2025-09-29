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
const search_1 = __importDefault(require("./search"));
const twitter_1 = __importDefault(require("./twitter"));
const auth_1 = __importDefault(require("./auth"));
const card_1 = __importDefault(require("./card"));
const competitors_1 = __importDefault(require("./competitors"));
const sources_1 = __importDefault(require("./sources"));
const gemini_1 = __importDefault(require("./gemini"));
const register = (server, options, done) => __awaiter(void 0, void 0, void 0, function* () {
    // Register search routes
    yield (0, search_1.default)(server);
    yield (0, twitter_1.default)(server, {});
    yield (0, auth_1.default)(server);
    yield (0, card_1.default)(server);
    yield (0, competitors_1.default)(server);
    yield (0, sources_1.default)(server);
    yield (0, gemini_1.default)(server);
    const getStatus = (request, reply) => __awaiter(void 0, void 0, void 0, function* () {
        return reply.status(200).send("API is live");
    });
    const successSchema = {};
    server.get("/", {
        schema: {
            response: {
                200: successSchema,
            },
        },
        handler: getStatus,
    });
    done();
});
exports.default = register;
