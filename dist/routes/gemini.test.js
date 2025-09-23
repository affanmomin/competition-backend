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
const node_test_1 = require("node:test");
const server_1 = require("../server");
(0, node_test_1.describe)("Gemini API Routes", () => {
    let app;
    (0, node_test_1.beforeAll)(() => __awaiter(void 0, void 0, void 0, function* () {
        app = (0, server_1.build)();
        yield app.ready();
    }));
    (0, node_test_1.afterAll)(() => __awaiter(void 0, void 0, void 0, function* () {
        yield app.close();
    }));
    (0, node_test_1.describe)("GET /api/gemini/health", () => {
        (0, node_test_1.it)("should return health status", () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield app.inject({
                method: "GET",
                url: "/api/gemini/health"
            });
            (0, node_test_1.expect)(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            (0, node_test_1.expect)(body.success).toBe(true);
            (0, node_test_1.expect)(body).toHaveProperty("status");
            (0, node_test_1.expect)(body).toHaveProperty("api_key_configured");
        }));
    });
    (0, node_test_1.describe)("POST /api/gemini/analyze", () => {
        (0, node_test_1.it)("should validate request body", () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield app.inject({
                method: "POST",
                url: "/api/gemini/analyze",
                payload: {
                // Missing required dataset field
                }
            });
            (0, node_test_1.expect)(response.statusCode).toBe(400);
            const body = JSON.parse(response.body);
            (0, node_test_1.expect)(body.success).toBe(false);
            (0, node_test_1.expect)(body.error).toContain("validation");
        }));
        (0, node_test_1.it)("should require dataset array", () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield app.inject({
                method: "POST",
                url: "/api/gemini/analyze",
                payload: {
                    dataset: "not an array"
                }
            });
            (0, node_test_1.expect)(response.statusCode).toBe(400);
        }));
    });
    (0, node_test_1.describe)("POST /api/gemini/generate", () => {
        (0, node_test_1.it)("should validate request body", () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield app.inject({
                method: "POST",
                url: "/api/gemini/generate",
                payload: {
                // Missing required text field
                }
            });
            (0, node_test_1.expect)(response.statusCode).toBe(400);
            const body = JSON.parse(response.body);
            (0, node_test_1.expect)(body.success).toBe(false);
            (0, node_test_1.expect)(body.error).toContain("validation");
        }));
        (0, node_test_1.it)("should require text field", () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield app.inject({
                method: "POST",
                url: "/api/gemini/generate",
                payload: {
                    text: ""
                }
            });
            (0, node_test_1.expect)(response.statusCode).toBe(400);
        }));
    });
});
