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
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const supertest_1 = __importDefault(require("supertest"));
const server_1 = __importDefault(require("../server"));
const RESOURCE_URI = '/';
(0, node_test_1.describe)(`${RESOURCE_URI}`, () => {
    (0, node_test_1.before)(() => __awaiter(void 0, void 0, void 0, function* () {
        yield server_1.default.ready();
    }));
    function act(token) {
        const req = (0, supertest_1.default)(server_1.default.server).get(RESOURCE_URI);
        if (token)
            return req.set('Authorization', `Bearer ${token}`);
        return req;
    }
    (0, node_test_1.test)('it works', () => __awaiter(void 0, void 0, void 0, function* () {
        const { status } = yield act();
        strict_1.default.equal(status, 200);
    }));
});
