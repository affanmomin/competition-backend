import { FastifyInstance } from "fastify";
import {
  analyzeCompetitorData,
  generateText,
  type GeminiAnalysisRequest,
  type GeminiTextRequest
} from "../services/gemini-service";
import {
  CompetitorAnalysisRequestSchema,
  TextGenerationRequestSchema,
  CompetitorAnalysisResponseSchema,
  TextGenerationResponseSchema
} from "../schemas/gemini-schemas";

/**
 * Gemini API routes for AI-powered analysis and text generation
 */
export default async function geminiRoutes(fastify: FastifyInstance) {
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
        required: ["dataset"],
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
    handler: async (request, reply) => {
      try {
        const validatedData = CompetitorAnalysisRequestSchema.parse(request.body);

        const analysisRequest: GeminiAnalysisRequest = {
          dataset: validatedData.dataset,
          prompt: validatedData.prompt
        };

        const result = await analyzeCompetitorData(analysisRequest);

        // Validate the response
        const validatedResult = CompetitorAnalysisResponseSchema.parse(result);

        return {
          success: true,
          data: validatedResult
        };
      } catch (error) {
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
          error: "Failed to analyze competitor data"
        });
      }
    }
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
    handler: async (request, reply) => {
      try {
        const validatedData = TextGenerationRequestSchema.parse(request.body);

        const textRequest: GeminiTextRequest = {
          text: validatedData.text,
          prompt: validatedData.prompt
        };

        const result = await generateText(textRequest);

        // Validate the response
        const validatedResult = TextGenerationResponseSchema.parse(result);

        return {
          success: true,
          data: validatedResult
        };
      } catch (error) {
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
    }
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
    handler: async (request, reply) => {
      const apiKeyConfigured = !!process.env.GEMINI_API_KEY;

      return {
        success: true,
        status: apiKeyConfigured ? "ready" : "not_configured",
        api_key_configured: apiKeyConfigured
      };
    }
  });
}
