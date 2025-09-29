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
exports.default = searchRoutes;
const zod_1 = require("zod");
// import { performGoogleSearch } from "../google-search";
const searchQuerySchema = zod_1.z.object({
    query: zod_1.z.string().min(1).max(100),
});
function searchRoutes(fastify) {
    return __awaiter(this, void 0, void 0, function* () {
        fastify.post("/search", {
            schema: {
                body: {
                    type: "object",
                    required: ["query"],
                    properties: {
                        query: { type: "string" },
                    },
                },
            },
            handler: (request, reply) => __awaiter(this, void 0, void 0, function* () {
                const { query } = searchQuerySchema.parse(request.body);
                try {
                    // const results = await performGoogleSearch(query);
                    // return { success: true, results };
                }
                catch (error) {
                    fastify.log.error(error);
                    return reply.status(500).send({
                        success: false,
                        error: "Failed to perform search",
                    });
                }
            }),
        });
    });
}
