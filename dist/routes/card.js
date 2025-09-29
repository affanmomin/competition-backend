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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = cardRoutes;
const zod_1 = require("zod");
const card_service_1 = require("../services/card-service");
const query_registry_1 = require("../services/query-registry");
const CardRequestSchema = zod_1.z.object({
    queries: zod_1.z.array(zod_1.z.string()).min(1),
    user_id: zod_1.z.string(),
    start_date: zod_1.z.string().datetime().optional(),
    end_date: zod_1.z.string().datetime().optional(),
});
function cardRoutes(fastify) {
    return __awaiter(this, void 0, void 0, function* () {
        // Get available card types
        fastify.get("/cards", () => __awaiter(this, void 0, void 0, function* () {
            return {
                available_cards: (0, query_registry_1.getAllQueryKeys)(),
            };
        }));
        // Execute card queries
        fastify.post("/cards", {
            schema: {
                body: {
                    type: "object",
                    required: ["queries", "user_id"],
                    properties: {
                        queries: { type: "array", items: { type: "string" }, minItems: 1 },
                        user_id: { type: "string" },
                        start_date: { type: "string", format: "date-time" },
                        end_date: { type: "string", format: "date-time" },
                    },
                },
            },
        }, (request, reply) => __awaiter(this, void 0, void 0, function* () {
            try {
                const body = CardRequestSchema.parse(request.body);
                const { queries } = body, params = __rest(body, ["queries"]);
                // Validate query parameters
                const validatedParams = query_registry_1.QueryParamsSchema.parse(params);
                // Execute queries
                const results = yield card_service_1.cardService.executeQueries(queries, validatedParams);
                return {
                    success: true,
                    data: results,
                };
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Unknown error";
                reply.status(400).send({
                    success: false,
                    error: errorMessage,
                });
            }
        }));
        // Get all competitors for a user
        fastify.get("/competitors/:user_id", {
            schema: {
                params: {
                    type: "object",
                    required: ["user_id"],
                    properties: {
                        user_id: { type: "string" },
                    },
                },
                querystring: {
                    type: "object",
                    properties: {
                        start_date: { type: "string", format: "date-time" },
                        end_date: { type: "string", format: "date-time" },
                    },
                },
            },
        }, (request, reply) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { user_id } = request.params;
                const { start_date, end_date } = request.query;
                const params = query_registry_1.QueryParamsSchema.parse({
                    user_id,
                    start_date,
                    end_date,
                });
                const results = yield card_service_1.cardService.executeQueries(["all-competitors"], params);
                return {
                    success: true,
                    data: results["all-competitors"] || [],
                };
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Unknown error";
                reply.status(400).send({
                    success: false,
                    error: errorMessage,
                });
            }
        }));
        // Get all leads for a user
        fastify.get("/leads/:user_id", {
            schema: {
                params: {
                    type: "object",
                    required: ["user_id"],
                    properties: {
                        user_id: { type: "string" },
                    },
                },
                querystring: {
                    type: "object",
                    properties: {
                        start_date: { type: "string", format: "date-time" },
                        end_date: { type: "string", format: "date-time" },
                    },
                },
            },
        }, (request, reply) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { user_id } = request.params;
                const { start_date, end_date } = request.query;
                const params = query_registry_1.QueryParamsSchema.parse({
                    user_id,
                    start_date,
                    end_date,
                });
                const results = yield card_service_1.cardService.executeQueries(["all-leads"], params);
                return {
                    success: true,
                    data: results["all-leads"] || [],
                };
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Unknown error";
                reply.status(400).send({
                    success: false,
                    error: errorMessage,
                });
            }
        }));
        // Get competitor-specific card data
        fastify.get("/cards/competitor/:competitor_id", {
            schema: {
                params: {
                    type: "object",
                    required: ["competitor_id"],
                    properties: {
                        competitor_id: { type: "string" },
                    },
                },
                querystring: {
                    type: "object",
                    properties: {
                        user_id: { type: "string" },
                        start_date: { type: "string", format: "date-time" },
                        end_date: { type: "string", format: "date-time" },
                    },
                    required: ["user_id"],
                },
            },
        }, (request, reply) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { competitor_id } = request.params;
                const { user_id, start_date, end_date } = request.query;
                // Validate the standard query parameters
                const params = query_registry_1.QueryParamsSchema.parse({
                    user_id,
                    start_date,
                    end_date,
                });
                // Define the competitor-specific queries to execute
                const competitorQueries = [
                    "competitor-top-complaints-short",
                    "competitor-top-features-short",
                    "competitor-top-alternatives-short",
                    "competitor-recent-switching-leads",
                    "competitor-complaint-trend",
                ];
                // Execute competitor-specific queries
                const results = yield card_service_1.cardService.executeCompetitorQueries(competitorQueries, Object.assign(Object.assign({}, params), { competitor_id }));
                return {
                    success: true,
                    data: results,
                };
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Unknown error";
                reply.status(400).send({
                    success: false,
                    error: errorMessage,
                });
            }
        }));
        //get competitor by id
    });
}
