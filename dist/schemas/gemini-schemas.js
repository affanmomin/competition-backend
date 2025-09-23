"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiApiRequestSchema = exports.TextGenerationRequestSchema = exports.CompetitorAnalysisRequestSchema = exports.TextGenerationResponseSchema = exports.CompetitorAnalysisResponseSchema = exports.AlternativeItemSchema = exports.LeadItemSchema = exports.EvidenceItemSchema = void 0;
const zod_1 = require("zod");
/**
 * Schema for evidence item in analysis results
 */
exports.EvidenceItemSchema = zod_1.z.object({
    canonical: zod_1.z.string().min(1).max(200),
    evidence_ids: zod_1.z.array(zod_1.z.string()).max(10)
});
/**
 * Schema for lead information in analysis results
 */
exports.LeadItemSchema = zod_1.z.object({
    username: zod_1.z.string().min(1).max(100),
    platform: zod_1.z.string().min(1).max(50),
    excerpt: zod_1.z.string().min(1).max(500),
    reason: zod_1.z.string().min(1).max(200)
});
/**
 * Schema for alternative information in analysis results
 */
exports.AlternativeItemSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    evidence_ids: zod_1.z.array(zod_1.z.string()).max(10),
    platform: zod_1.z.string().min(1).max(50),
    mention_context: zod_1.z.string().min(1).max(200).optional(),
    confidence_score: zod_1.z.number().min(0).max(1).optional()
});
/**
 * Schema for competitor analysis response
 */
exports.CompetitorAnalysisResponseSchema = zod_1.z.object({
    features: zod_1.z.array(exports.EvidenceItemSchema).max(5),
    complaints: zod_1.z.array(exports.EvidenceItemSchema).max(5),
    leads: zod_1.z.array(exports.LeadItemSchema).max(5),
    alternatives: zod_1.z.array(exports.AlternativeItemSchema).max(5)
});
/**
 * Schema for text generation response
 */
exports.TextGenerationResponseSchema = zod_1.z.object({
    text: zod_1.z.string(),
    usage: zod_1.z.object({
        prompt_tokens: zod_1.z.number().min(0),
        completion_tokens: zod_1.z.number().min(0),
        total_tokens: zod_1.z.number().min(0)
    }).optional()
});
/**
 * Schema for competitor analysis request
 */
exports.CompetitorAnalysisRequestSchema = zod_1.z.object({
    dataset: zod_1.z.array(zod_1.z.any()).min(1).max(1000),
    prompt: zod_1.z.string().max(2000).optional(),
    user_id: zod_1.z.string().min(1),
    competitor_id: zod_1.z.string().min(1).optional()
});
/**
 * Schema for text generation request
 */
exports.TextGenerationRequestSchema = zod_1.z.object({
    text: zod_1.z.string().min(1).max(10000),
    prompt: zod_1.z.string().max(1000).optional()
});
/**
 * Schema for general Gemini API request
 */
exports.GeminiApiRequestSchema = zod_1.z.object({
    text: zod_1.z.string().min(1).max(10000),
    prompt: zod_1.z.string().max(1000).optional(),
    temperature: zod_1.z.number().min(0).max(2).optional(),
    max_tokens: zod_1.z.number().min(1).max(4096).optional()
});
