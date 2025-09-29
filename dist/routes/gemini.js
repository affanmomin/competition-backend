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
exports.default = geminiRoutes;
const gemini_service_1 = require("../services/gemini-service");
const gemini_schemas_1 = require("../schemas/gemini-schemas");
const competitor_analysis_service_1 = require("../services/competitor-analysis-service");
/**
 * Gemini API routes for AI-powered analysis and text generation
 */
function geminiRoutes(fastify) {
    return __awaiter(this, void 0, void 0, function* () {
        /**
         * Analyze competitor data using Gemini AI
         * POST /api/gemini/analyze
         */
        fastify.post("/analyze", {
            schema: {
                description: "Analyze social media data for competitor research insights",
                tags: ["gemini"],
                body: {
                    type: "object",
                    required: ["dataset", "user_id"],
                    properties: {
                        dataset: {
                            type: "array",
                            description: "Array of social media posts and comments to analyze",
                            items: { type: "object" }
                        },
                        prompt: {
                            type: "string",
                            description: "Optional custom prompt for analysis",
                            maxLength: 2000
                        },
                        user_id: {
                            type: "string",
                            description: "ID of the user performing the analysis",
                            minLength: 1
                        },
                        competitor_id: {
                            type: "string",
                            description: "Optional ID of the competitor being analyzed",
                            minLength: 1
                        }
                    }
                },
                response: {
                    200: {
                        type: "object",
                        properties: {
                            success: { type: "boolean" },
                            data: {
                                type: "object",
                                properties: {
                                    features: {
                                        type: "array",
                                        items: {
                                            type: "object",
                                            properties: {
                                                canonical: { type: "string" },
                                                evidence_ids: { type: "array", items: { type: "string" } }
                                            }
                                        }
                                    },
                                    complaints: {
                                        type: "array",
                                        items: {
                                            type: "object",
                                            properties: {
                                                canonical: { type: "string" },
                                                evidence_ids: { type: "array", items: { type: "string" } }
                                            }
                                        }
                                    },
                                    leads: {
                                        type: "array",
                                        items: {
                                            type: "object",
                                            properties: {
                                                username: { type: "string" },
                                                platform: { type: "string" },
                                                excerpt: { type: "string" },
                                                reason: { type: "string" }
                                            }
                                        }
                                    },
                                    alternatives: {
                                        type: "array",
                                        items: {
                                            type: "object",
                                            properties: {
                                                name: { type: "string" },
                                                evidence_ids: { type: "array", items: { type: "string" } },
                                                platform: { type: "string" }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    400: {
                        type: "object",
                        properties: {
                            success: { type: "boolean" },
                            error: { type: "string" }
                        }
                    },
                    500: {
                        type: "object",
                        properties: {
                            success: { type: "boolean" },
                            error: { type: "string" }
                        }
                    }
                }
            },
            handler: (request, reply) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const validatedData = gemini_schemas_1.CompetitorAnalysisRequestSchema.parse(request.body);
                    const analysisRequest = {
                        dataset: validatedData.dataset,
                    };
                    const result = yield (0, gemini_service_1.analyzeCompetitorData)(analysisRequest);
                    // Validate the response
                    const validatedResult = gemini_schemas_1.CompetitorAnalysisResponseSchema.parse(result);
                    // Insert the analysis data into the database
                    yield (0, competitor_analysis_service_1.insertCompetitorAnalysisData)({
                        userId: validatedData.user_id,
                        competitorId: validatedData.competitor_id,
                        analysisData: validatedResult
                    });
                    return {
                        success: true,
                        data: validatedResult
                    };
                }
                catch (error) {
                    fastify.log.error(error);
                    if (error instanceof Error) {
                        if (error.message.includes("GEMINI_API_KEY")) {
                            return reply.status(500).send({
                                success: false,
                                error: "Gemini API key not configured"
                            });
                        }
                        if (error.message.includes("validation")) {
                            return reply.status(400).send({
                                success: false,
                                error: `Validation error: ${error.message}`
                            });
                        }
                        if (error.message.includes("database") || error.message.includes("INSERT") || error.message.includes("relation")) {
                            return reply.status(500).send({
                                success: false,
                                error: "Database error while saving analysis results"
                            });
                        }
                    }
                    return reply.status(500).send({
                        success: false,
                        error: "Failed to analyze competitor data"
                    });
                }
            })
        });
        /**
         * Generate text using Gemini AI
         * POST /api/gemini/generate
         */
        fastify.post("/generate", {
            schema: {
                description: "Generate text using Gemini AI",
                tags: ["gemini"],
                body: {
                    type: "object",
                    required: ["text"],
                    properties: {
                        text: {
                            type: "string",
                            description: "Input text to process",
                            minLength: 1,
                            maxLength: 10000
                        },
                        prompt: {
                            type: "string",
                            description: "Optional custom prompt for text generation",
                            maxLength: 1000
                        }
                    }
                },
                response: {
                    200: {
                        type: "object",
                        properties: {
                            success: { type: "boolean" },
                            data: {
                                type: "object",
                                properties: {
                                    text: { type: "string" },
                                    usage: {
                                        type: "object",
                                        properties: {
                                            prompt_tokens: { type: "number" },
                                            completion_tokens: { type: "number" },
                                            total_tokens: { type: "number" }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    400: {
                        type: "object",
                        properties: {
                            success: { type: "boolean" },
                            error: { type: "string" }
                        }
                    },
                    500: {
                        type: "object",
                        properties: {
                            success: { type: "boolean" },
                            error: { type: "string" }
                        }
                    }
                }
            },
            handler: (request, reply) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const validatedData = gemini_schemas_1.TextGenerationRequestSchema.parse(request.body);
                    const textRequest = {
                        text: validatedData.text,
                        prompt: validatedData.prompt
                    };
                    const result = yield (0, gemini_service_1.generateText)(textRequest);
                    // Validate the response
                    const validatedResult = gemini_schemas_1.TextGenerationResponseSchema.parse(result);
                    return {
                        success: true,
                        data: validatedResult
                    };
                }
                catch (error) {
                    fastify.log.error(error);
                    if (error instanceof Error) {
                        if (error.message.includes("GEMINI_API_KEY")) {
                            return reply.status(500).send({
                                success: false,
                                error: "Gemini API key not configured"
                            });
                        }
                        if (error.message.includes("validation")) {
                            return reply.status(400).send({
                                success: false,
                                error: `Validation error: ${error.message}`
                            });
                        }
                    }
                    return reply.status(500).send({
                        success: false,
                        error: "Failed to generate text"
                    });
                }
            })
        });
        /**
         * Health check for Gemini API
         * GET /api/gemini/health
         */
        fastify.get("/health", {
            schema: {
                description: "Check Gemini API health and configuration",
                tags: ["gemini"],
                response: {
                    200: {
                        type: "object",
                        properties: {
                            success: { type: "boolean" },
                            status: { type: "string" },
                            api_key_configured: { type: "boolean" }
                        }
                    }
                }
            },
            handler: (request, reply) => __awaiter(this, void 0, void 0, function* () {
                const apiKeyConfigured = !!process.env.GEMINI_API_KEY;
                return {
                    success: true,
                    status: apiKeyConfigured ? "ready" : "not_configured",
                    api_key_configured: apiKeyConfigured
                };
            })
        });
    });
}
