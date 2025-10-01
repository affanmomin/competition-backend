import { z } from "zod";

/**
 * Schema for evidence item in analysis results
 */
export const EvidenceItemSchema = z.object({
  canonical: z.string().min(1).max(200),
  evidence_ids: z.array(z.string()).max(10),
});

/**
 * Schema for lead information in analysis results
 */
export const LeadItemSchema = z.object({
  username: z.string().min(1).max(100),
  platform: z.string().min(1).max(50),
  excerpt: z.string().min(1).max(500),
  reason: z.string().min(1).max(200),
});

/**
 * Schema for alternative information in analysis results
 */
export const AlternativeItemSchema = z.object({
  name: z.string().min(1).max(100),
  evidence_ids: z.array(z.string()).max(10),
  platform: z.string().min(1).max(50),
  mention_context: z.string().min(1).max(200).optional(),
  confidence_score: z.number().min(0).max(1).optional(),
});

/**
 * Schema for competitor analysis response
 */
export const CompetitorAnalysisResponseSchema = z.object({
  features: z.array(EvidenceItemSchema).max(5),
  complaints: z.array(EvidenceItemSchema).max(5),
  leads: z.array(LeadItemSchema).max(5),
  alternatives: z.array(AlternativeItemSchema).max(5),
});

/**
 * Schema for text generation response
 */
export const TextGenerationResponseSchema = z.object({
  text: z.string(),
  usage: z
    .object({
      prompt_tokens: z.number().min(0),
      completion_tokens: z.number().min(0),
      total_tokens: z.number().min(0),
    })
    .optional(),
});

/**
 * Schema for competitor analysis request
 */
export const CompetitorAnalysisRequestSchema = z.object({
  dataset: z.array(z.any()).min(1).max(1000),
  prompt: z.string().max(2000).optional(),
  user_id: z.string().min(1),
  competitor_id: z.string().min(1).optional(),
});

/**
 * Schema for simple dataset-only analysis requests
 * Useful for testing analysis prompts with scraped JSON without requiring IDs
 */
export const SimpleDatasetAnalysisRequestSchema = z.object({
  dataset: z.array(z.any()).min(1).max(2000),
  user_id: z.string().min(1).optional(),
  competitor_id: z.string().min(1).optional(),
  save: z.boolean().optional(),
});

/**
 * Schema for text generation request
 */
export const TextGenerationRequestSchema = z.object({
  text: z.string().min(1).max(10000),
  prompt: z.string().max(1000).optional(),
});

/**
 * Schema for general Gemini API request
 */
export const GeminiApiRequestSchema = z.object({
  text: z.string().min(1).max(10000),
  prompt: z.string().max(1000).optional(),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().min(1).max(4096).optional(),
});

/**
 * Type exports for use in other files
 */
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;
export type LeadItem = z.infer<typeof LeadItemSchema>;
export type AlternativeItem = z.infer<typeof AlternativeItemSchema>;
export type CompetitorAnalysisResponse = z.infer<
  typeof CompetitorAnalysisResponseSchema
>;
export type TextGenerationResponse = z.infer<
  typeof TextGenerationResponseSchema
>;
export type CompetitorAnalysisRequest = z.infer<
  typeof CompetitorAnalysisRequestSchema
>;
export type TextGenerationRequest = z.infer<typeof TextGenerationRequestSchema>;
export type GeminiApiRequest = z.infer<typeof GeminiApiRequestSchema>;
export type SimpleDatasetAnalysisRequest = z.infer<
  typeof SimpleDatasetAnalysisRequestSchema
>;
