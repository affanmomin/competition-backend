import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import client from "../db";
import { scrapeCompanyPosts } from "../linkedin-scraper";
import { scrapeTwitterPosts } from "../twitter-scraper";
import { scrapeCompanyWebsite } from "../website-scraper";
import { scrapeGoogleMapsData } from "../google-maps-scraper";
import { scrapeGoogleBusinessData } from "../google-business-scraper";
import {
  analyzeCompetitorData,
  analyzeWebpageData,
} from "../services/gemini-service";
import * as fs from "fs-extra";
import * as path from "path";
import { CompetitorAnalysisResponseSchema } from "../schemas/gemini-schemas";
import { insertCompetitorAnalysisData } from "../services/competitor-analysis-service";

interface PlatformData {
  source_id: string;
  username?: string; // Platform-specific username or identifier
}

interface CompetitorBody {
  name: string;
  slug: string;
  user_id: string;
  platforms?: PlatformData[]; // Array of platform data with source IDs and usernames
  // Keeping for backward compatibility
  source_ids?: string[];
}

interface CompetitorQuery {
  user_id?: string;
  limit?: string;
  offset?: string;
}

interface CompetitorParams {
  id: string;
}

interface DeleteCompetitorBody {
  user_id?: string;
}

export default async function competitorsRoutes(fastify: FastifyInstance) {
  // Add competitor
  fastify.post<{ Body: CompetitorBody }>(
    "/api/competitors",
    async (
      request: FastifyRequest<{ Body: CompetitorBody }>,
      reply: FastifyReply,
    ) => {
      try {
        const { name, user_id, source_ids, platforms } = request.body;

        // Validate required fields
        if (!name || !user_id) {
          return reply.code(400).send({
            error: "Missing required fields: name and user_id are required",
          });
        }

        // Handle both new platforms format and legacy source_ids format
        let platformsToProcess: PlatformData[] = [];

        if (platforms && platforms.length > 0) {
          // Validate platform data structure
          for (const platform of platforms) {
            if (!platform.source_id) {
              return reply.code(400).send({
                error: "Each platform must have a source_id",
              });
            }
            if (typeof platform.source_id !== "string") {
              return reply.code(400).send({
                error: "Platform source_id must be a string",
              });
            }
            if (platform.username && typeof platform.username !== "string") {
              return reply.code(400).send({
                error: "Platform username must be a string if provided",
              });
            }
          }
          platformsToProcess = platforms;
        } else if (source_ids && source_ids.length > 0) {
          // Convert legacy source_ids to platform format
          platformsToProcess = source_ids.map((id) => ({ source_id: id }));
        }

        if (platformsToProcess.length === 0) {
          return reply.code(400).send({
            error: "At least one platform or source_id is required",
          });
        }

        // Generate slug from name
        const slug = name
          .toLowerCase()
          .trim()
          .replace(/\s+/g, "-") // Replace spaces with hyphens
          .replace(/[^\w\-]+/g, "") // Remove all non-word chars
          .replace(/\-\-+/g, "-"); // Replace multiple hyphens with ek hypehn

        // Start transaction
        await client.query("BEGIN");

        try {
          // Insert competitor
          const competitorQuery = `
          INSERT INTO public.competitors (name, slug, user_id)
          VALUES ($1, $2, $3)
          RETURNING *
        `;

          const competitorResult = await client.query(competitorQuery, [
            name,
            slug,
            user_id,
          ]);
          const competitor = competitorResult.rows[0];

          // Insert platform associations
          if (platformsToProcess.length > 0) {
            for (const platform of platformsToProcess) {
              const sourceQuery = `
              INSERT INTO public.competitor_sources (competitor_id, source_id, username)
              VALUES ($1, $2, $3)
            `;
              await client.query(sourceQuery, [
                competitor.competitor_id,
                platform.source_id,
                platform.username || null,
              ]);
            }
          }

          // Commit transaction first to ensure competitor is saved
          await client.query("COMMIT");

          // Now perform scraping and analysis based on platform data
          try {
            let allScrapedData: any[] = [];
            const TWITTER_SOURCE_ID = "5d53c057-6e63-47c6-9301-192a3b9fa1d4";
            const LINKEDIN_SOURCE_ID = "4a267045-dbfc-432c-96a5-17a9da542248";
            const WEBSITE_SOURCE_ID = "da6acd0d-7b5e-4aec-8d0c-9126220a8341";
            const GOOGLE_MAPS_SOURCE_ID =
              "8e7857f1-d153-4470-bd6a-cf4ad79bb8fe";
            const GOOGLE_BUSINESS_SOURCE_ID =
              "4ee3988d-70a4-4dd4-8708-5441de698a38";

            // Process each platform
            for (const platform of platformsToProcess) {
              let scraperData: any[] = [];
              const targetName = platform.username || name; // Use platform username if available, fallback to company name

              switch (platform.source_id) {
                case TWITTER_SOURCE_ID:
                  console.log(`Starting Twitter scraping for: ${targetName}`);
                  scraperData = await scrapeTwitterPosts(targetName);
                  break;

                case LINKEDIN_SOURCE_ID:
                  console.log(`Starting LinkedIn scraping for: ${targetName}`);
                  scraperData = await scrapeCompanyPosts(targetName);
                  break;

                case WEBSITE_SOURCE_ID:
                  console.log(`Starting website scraping for: ${targetName}`);
                  scraperData = await scrapeCompanyWebsite(targetName);
                  break;

                case GOOGLE_MAPS_SOURCE_ID:
                  console.log(
                    `Starting Google Maps scraping for: ${targetName}`,
                  );
                  scraperData = await scrapeGoogleMapsData(targetName);
                  break;

                case GOOGLE_BUSINESS_SOURCE_ID:
                  console.log(
                    `Starting Google Business scraping for: ${targetName}`,
                  );
                  scraperData = await scrapeGoogleBusinessData(targetName);
                  break;

                default:
                  console.warn(`Unknown source ID: ${platform.source_id}`);
                  continue;
              }

              if (scraperData && scraperData.length > 0) {
                allScrapedData.push(...scraperData);
                console.log(
                  `Successfully scraped ${scraperData.length} posts from source ${platform.source_id} for ${targetName}`,
                );
              } else {
                console.warn(
                  `No data found for source ${platform.source_id} and target: ${targetName}`,
                );
              }
            }

            if (allScrapedData.length === 0) {
              return reply.code(201).send({
                success: true,
                data: competitor,
                warning:
                  "Competitor created but no data found from any source. Company may not exist on the specified platforms or scraping failed.",
              });
            }

            console.log(`Total scraped posts: ${allScrapedData.length}`);

            // Step 3: Analyze with Gemini
            const analysisResult = await analyzeCompetitorData({
              dataset: allScrapedData,
            });

            const validatedResult =
              CompetitorAnalysisResponseSchema.parse(analysisResult);

            // Insert the analysis data into the database
            const insertResponse = await insertCompetitorAnalysisData({
              userId: user_id,
              competitorId: competitor.competitor_id,
              analysisData: validatedResult,
            });

            console.log(`Analysis data inserted.`, insertResponse);

            return reply.code(200).send({
              success: true,
              data: competitor,
              analysis: {
                posts_scraped: allScrapedData.length,
                features_found: analysisResult.features?.length || 0,
                complaints_found: analysisResult.complaints?.length || 0,
                leads_found: analysisResult.leads?.length || 0,
                alternatives_found: analysisResult.alternatives?.length || 0,
              },
            });
          } catch (scrapingError: any) {
            console.error("Error during scraping/analysis:", scrapingError);

            // Return success for competitor creation but with scraping error
            if (
              scrapingError.message?.includes("Twitter") ||
              scrapingError.message?.includes("LinkedIn") ||
              scrapingError.message?.includes("website") ||
              scrapingError.message?.includes("Google Maps") ||
              scrapingError.message?.includes("Google Business")
            ) {
              return reply.code(201).send({
                success: true,
                data: competitor,
                error:
                  "Competitor created successfully, but scraping failed. The company page may not exist or be accessible on the specified platforms.",
              });
            } else if (scrapingError.message?.includes("GEMINI_API_KEY")) {
              return reply.code(201).send({
                success: true,
                data: competitor,
                error:
                  "Competitor created and scraped successfully, but Gemini AI analysis failed due to missing API key.",
              });
            } else if (scrapingError.message?.includes("Gemini")) {
              return reply.code(201).send({
                success: true,
                data: competitor,
                error:
                  "Competitor created and scraped successfully, but Gemini AI analysis failed.",
              });
            } else {
              return reply.code(201).send({
                success: true,
                data: competitor,
                error: `Competitor created successfully, but analysis failed: ${scrapingError.message}`,
              });
            }
          }
        } catch (transactionError) {
          await client.query("ROLLBACK");
          throw transactionError;
        }
      } catch (error: any) {
        console.error("Error adding competitor:", error);

        // Handle unique constraint violation
        if (error.code === "23505") {
          return reply.code(409).send({
            error:
              "Competitor with this slug already exists or duplicate source assignment",
          });
        }

        // Handle foreign key constraint violation
        if (error.code === "23503") {
          return reply.code(400).send({
            error:
              "Invalid user_id or source_id: referenced record does not exist",
          });
        }

        return reply.code(500).send({
          error: "Internal server error",
        });
      }
    },
  );

  // Get competitors
  fastify.get<{ Querystring: CompetitorQuery }>(
    "/api/competitors",
    async (
      request: FastifyRequest<{ Querystring: CompetitorQuery }>,
      reply: FastifyReply,
    ) => {
      try {
        const { user_id, limit = "50", offset = "0" } = request.query;

        let query = "SELECT * FROM public.competitors";
        const params: any[] = [];

        // Filter by user_id if provided
        if (user_id) {
          query += " WHERE user_id = $1";
          params.push(user_id);
        }

        query += " ORDER BY created_at DESC";

        // Add pagination
        if (user_id) {
          query += " LIMIT $2 OFFSET $3";
          params.push(parseInt(limit), parseInt(offset));
        } else {
          query += " LIMIT $1 OFFSET $2";
          params.push(parseInt(limit), parseInt(offset));
        }

        const result = await client.query(query, params);

        return {
          success: true,
          data: result.rows,
          pagination: {
            limit: parseInt(limit),
            offset: parseInt(offset),
            count: result.rows.length,
          },
        };
      } catch (error: any) {
        console.error("Error fetching competitors:", error);
        return reply.code(500).send({
          error: "Internal server error",
        });
      }
    },
  );

  // Get single competitor by ID
  fastify.get<{ Params: CompetitorParams }>(
    "/api/competitors/:id",
    async (
      request: FastifyRequest<{ Params: CompetitorParams }>,
      reply: FastifyReply,
    ) => {
      try {
        const { id } = request.params;

        const query = "SELECT * FROM public.competitors WHERE id = $1";
        const result = await client.query(query, [id]);

        if (result.rows.length === 0) {
          return reply.code(404).send({
            error: "Competitor not found",
          });
        }

        return {
          success: true,
          data: result.rows[0],
        };
      } catch (error: any) {
        console.error("Error fetching competitor:", error);
        return reply.code(500).send({
          error: "Internal server error",
        });
      }
    },
  );

  // Delete competitor
  fastify.delete<{ Params: CompetitorParams; Body: DeleteCompetitorBody }>(
    "/api/competitors/:id",
    async (
      request: FastifyRequest<{
        Params: CompetitorParams;
        Body: DeleteCompetitorBody;
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const { id } = request.params;
        const { user_id } = request.body || {};

        let query = "DELETE FROM public.competitors WHERE competitor_id = $1";
        const params: any[] = [id];

        // If user_id is provided, ensure user can only delete their own competitors
        if (user_id) {
          query += " AND user_id = $2";
          params.push(user_id);
        }

        query += " RETURNING *";

        const result = await client.query(query, params);

        if (result.rows.length === 0) {
          return reply.code(404).send({
            error:
              "Competitor not found or you do not have permission to delete it",
          });
        }

        return {
          success: true,
          message: "Competitor deleted successfully",
          data: result.rows[0],
        };
      } catch (error: any) {
        console.error("Error deleting competitor:", error);
        return reply.code(500).send({
          error: "Internal server error",
        });
      }
    },
  );
}
