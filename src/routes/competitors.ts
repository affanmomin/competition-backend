import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import client from "../db";
import { scrapeCompanyPosts } from "../linkedin-scraper";
import { scrapeTwitterPosts } from "../twitter-scraper";
import { scrapeCompanyWebsite } from "../website-scraper";
import { scrapeGoogleMapsData } from "../google-maps-scraper";
import { scrapeGoogleBusinessData } from "../google-business-scraper";
import {
  analyzeCompetitorData,
  analyzeTwitterCompetitorData,
  analyzeWebpageData,
  analyzeLinkedInCompetitorData,
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
  is_user?: boolean; // Flag to indicate if this competitor is a user
  platforms?: PlatformData[]; // Array of platform data with source IDs and usernames
  // Keeping for backward compatibility
  source_ids?: string[];
}

interface CompetitorQuery {
  user_id?: string;
  limit?: string;
  offset?: string;
}

interface UserCompetitorQuery {
  user_id: string;
}

interface CompetitorParams {
  id: string;
}

interface DeleteCompetitorBody {
  user_id?: string;
}

interface UpdateCompetitorSourcesBody {
  user_id?: string;
  competitor_id: string; // Required competitor ID
  platforms: PlatformData[]; // Array of platform data to add
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
        const { name, user_id, source_ids, platforms, is_user } = request.body;

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
          INSERT INTO public.competitors (name, slug, user_id, is_user)
          VALUES ($1, $2, $3, $4)
          RETURNING *
        `;

          const competitorResult = await client.query(competitorQuery, [
            name,
            slug,
            user_id,
            is_user || false, // Default to false if not provided
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
            const GOOGLE_PLAYSTORE_SOURCE_ID =
              "4ee3988d-70a4-4dd4-8708-5441de698a38";

            // Process each platform
            for (const platform of platformsToProcess) {
              let scraperData: any[] = [];
              const targetName = platform.username || name; // Use platform username if available, fallback to company name

              switch (platform.source_id) {
                case TWITTER_SOURCE_ID:
                  console.log(`Starting Twitter scraping for: ${targetName}`);
                  scraperData = await scrapeTwitterPosts(targetName);

                  // Step 3: Analyze with Gemini
                  const twitterAnalysisResult =
                    await analyzeTwitterCompetitorData({
                      dataset: scraperData,
                    });

                  const validatedResult =
                    CompetitorAnalysisResponseSchema.parse(
                      twitterAnalysisResult,
                    );

                  // Insert the analysis data into the database
                  const insertResponse = await insertCompetitorAnalysisData({
                    userId: user_id,
                    competitorId: competitor.competitor_id,
                    analysisData: validatedResult,
                  });

                  console.log(`Analysis data inserted.`, insertResponse);
                  break;

                case LINKEDIN_SOURCE_ID:
                  console.log(`Starting LinkedIn scraping for: ${targetName}`);
                  scraperData = await scrapeCompanyPosts(targetName);

                  // Step 3: Analyze with Gemini
                  const linkedinAnalysisResult =
                    await analyzeLinkedInCompetitorData({
                      dataset: scraperData,
                    });

                  const validatedLinkedinResult =
                    CompetitorAnalysisResponseSchema.parse(
                      linkedinAnalysisResult,
                    );

                  // Insert the analysis data into the database
                  const insertLinkedinResponse =
                    await insertCompetitorAnalysisData({
                      userId: user_id,
                      competitorId: competitor.competitor_id,
                      analysisData: validatedLinkedinResult,
                    });

                  console.log(
                    `Analysis data inserted.`,
                    insertLinkedinResponse,
                  );
                  break;

                case WEBSITE_SOURCE_ID:
                  console.log(`Starting website scraping for: ${targetName}`);
                  scraperData = await scrapeCompanyWebsite(targetName);

                  const websiteAnalysisResult = await analyzeWebpageData({
                    dataset: scraperData,
                  });

                  const validatedWebsiteResult =
                    CompetitorAnalysisResponseSchema.parse(
                      websiteAnalysisResult,
                    );

                  // Insert the analysis data into the database
                  const insertWebsiteResponse =
                    await insertCompetitorAnalysisData({
                      userId: user_id,
                      competitorId: competitor.competitor_id,
                      analysisData: validatedWebsiteResult,
                    });

                  console.log(`Analysis data inserted.`, insertWebsiteResponse);
                  break;

                case GOOGLE_MAPS_SOURCE_ID:
                  console.log(
                    `Starting Google Maps scraping for: ${targetName}`,
                  );
                  scraperData = await scrapeGoogleMapsData(targetName);
                  break;

                case GOOGLE_PLAYSTORE_SOURCE_ID:
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

            return reply.code(200).send({
              success: true,
              data: competitor,
            });
          } catch (scrapingError) {
            // Log scraping errors but still return success since competitor was saved
            console.error("Error during scraping/analysis:", scrapingError);
            return reply.code(200).send({
              success: true,
              data: competitor,
              warning:
                "Competitor added successfully, but scraping/analysis failed",
            });
          }
        } catch (transactionError) {
          await client.query("ROLLBACK");
          throw transactionError;
        }
      } catch (error: any) {
        console.error("Error adding competitor:", error);
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

  // Get user competitors (is_user = true)
  fastify.get<{ Querystring: UserCompetitorQuery }>(
    "/user/company",
    async (
      request: FastifyRequest<{ Querystring: UserCompetitorQuery }>,
      reply: FastifyReply,
    ) => {
      try {
        const { user_id } = request.query;

        // Validate required user_id
        if (!user_id) {
          return reply.code(400).send({
            error: "user_id is required",
          });
        }
        const query = `
          SELECT 
            c.*,
            cs.id as competitor_source_id,
            cs.source_id,
            cs.username,
            cs.created_at as source_created_at,
            cs.updated_at as source_updated_at,
            s.platform,
            s.enabled,
            s.last_scraped_at
          FROM public.competitors c
          LEFT JOIN public.competitor_sources cs ON c.competitor_id = cs.competitor_id
          LEFT JOIN public.sources s ON cs.source_id = s.id
          WHERE c.user_id = $1 AND c.is_user = true 
          ORDER BY c.created_at DESC, cs.created_at DESC
          LIMIT 50
        `;

        const params = [user_id];
        const result = await client.query(query, params);

        if (result.rows.length === 0) {
          return {
            success: true,
            data: [],
          };
        }

        // Group the results by competitor (in case there are multiple sources)
        const competitorMap = new Map();

        for (const row of result.rows) {
          const competitorId = row.competitor_id;

          if (!competitorMap.has(competitorId)) {
            // Extract competitor data (excluding source-specific fields)
            const {
              competitor_source_id,
              source_id,
              username,
              source_created_at,
              source_updated_at,
              platform,
              enabled,
              last_scraped_at,
              ...competitorData
            } = row;

            competitorMap.set(competitorId, {
              ...competitorData,
              sources: [],
            });
          }

          // Add source data if it exists
          if (row.competitor_source_id) {
            competitorMap.get(competitorId).sources.push({
              competitor_source_id: row.competitor_source_id,
              competitor_id: row.competitor_id,
              source_id: row.source_id,
              username: row.username,
              source_created_at: row.source_created_at,
              source_updated_at: row.source_updated_at,
              platform: row.platform,
              enabled: row.enabled,
              last_scraped_at: row.last_scraped_at,
            });
          }
        }

        // Convert map to array and get the first (most recent) competitor
        const competitors = Array.from(competitorMap.values());

        return {
          success: true,
          data: competitors.slice(0, 1), // Only return the first/most recent one
        };
      } catch (error: any) {
        console.error("Error fetching user competitors:", error);
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

        // First get the competitor details
        const competitorQuery =
          "SELECT * FROM public.competitors WHERE competitor_id = $1";
        const competitorResult = await client.query(competitorQuery, [id]);

        if (competitorResult.rows.length === 0) {
          return reply.code(404).send({
            error: "Competitor not found",
          });
        }

        const competitor = competitorResult.rows[0];

        // Then get the competitor sources with source details
        const sourcesQuery = `
          SELECT 
            cs.id as competitor_source_id,
            cs.competitor_id,
            cs.source_id,
            cs.username,
            cs.created_at as source_created_at,
            cs.updated_at as source_updated_at,
            s.platform,
            s.enabled,
            s.last_scraped_at
          FROM public.competitor_sources cs
          LEFT JOIN public.sources s ON cs.source_id = s.id
          WHERE cs.competitor_id = $1
          ORDER BY cs.created_at DESC
        `;
        const sourcesResult = await client.query(sourcesQuery, [id]);

        return {
          success: true,
          data: {
            ...competitor,
            sources: sourcesResult.rows,
          },
        };
      } catch (error: any) {
        console.error("Error fetching competitor:", error);
        return reply.code(500).send({
          error: "Internal server error",
        });
      }
    },
  );

  // Update competitor sources (add new platform connections)
  fastify.post<{ Body: UpdateCompetitorSourcesBody }>(
    "/api/competitors/sources",
    async (
      request: FastifyRequest<{
        Body: UpdateCompetitorSourcesBody;
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const { user_id, competitor_id, platforms } = request.body;

        // Validate required fields
        if (!competitor_id) {
          return reply.code(400).send({
            error: "competitor_id is required",
          });
        }

        if (!platforms || platforms.length === 0) {
          return reply.code(400).send({
            error: "At least one platform is required",
          });
        }

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

        // Check if competitor exists and user has permission
        let competitorQuery =
          "SELECT * FROM public.competitors WHERE competitor_id = $1";
        const competitorParams: any[] = [competitor_id];

        if (user_id) {
          competitorQuery += " AND user_id = $2";
          competitorParams.push(user_id);
        }

        const competitorResult = await client.query(
          competitorQuery,
          competitorParams,
        );

        if (competitorResult.rows.length === 0) {
          return reply.code(404).send({
            error: user_id
              ? "Competitor not found or you do not have permission to update it"
              : "Competitor not found",
          });
        }

        const competitor = competitorResult.rows[0];

        // Get existing sources to prevent duplicates
        const existingSourcesQuery = `
          SELECT source_id FROM public.competitor_sources 
          WHERE competitor_id = $1
        `;
        const existingSourcesResult = await client.query(existingSourcesQuery, [
          competitor_id,
        ]);
        const existingSourceIds = existingSourcesResult.rows.map(
          (row) => row.source_id,
        );

        // Filter out platforms that already exist
        const newPlatforms = platforms.filter(
          (platform) => !existingSourceIds.includes(platform.source_id),
        );

        if (newPlatforms.length === 0) {
          return reply.code(409).send({
            error:
              "All specified platforms are already connected to this competitor",
            existing_sources: existingSourceIds,
          });
        }

        // Start transaction for adding new sources
        await client.query("BEGIN");

        try {
          // Insert new platform associations
          const addedSources: any[] = [];
          for (const platform of newPlatforms) {
            const sourceQuery = `
              INSERT INTO public.competitor_sources (competitor_id, source_id, username)
              VALUES ($1, $2, $3)
              RETURNING *
            `;
            const result = await client.query(sourceQuery, [
              competitor_id,
              platform.source_id,
              platform.username || null,
            ]);
            addedSources.push(result.rows[0]);
          }

          // Commit the database changes
          await client.query("COMMIT");

          // Now perform scraping and analysis for new platforms
          try {
            let allNewScrapedData: any[] = [];
            const TWITTER_SOURCE_ID = "5d53c057-6e63-47c6-9301-192a3b9fa1d4";
            const LINKEDIN_SOURCE_ID = "4a267045-dbfc-432c-96a5-17a9da542248";
            const WEBSITE_SOURCE_ID = "da6acd0d-7b5e-4aec-8d0c-9126220a8341";
            const GOOGLE_MAPS_SOURCE_ID =
              "8e7857f1-d153-4470-bd6a-cf4ad79bb8fe";
            const GOOGLE_PLAYSTORE_SOURCE_ID =
              "4ee3988d-70a4-4dd4-8708-5441de698a38";

            // Process each new platform
            for (const platform of newPlatforms) {
              let scraperData: any[] = [];
              const targetName = platform.username || competitor.name;

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

                case GOOGLE_PLAYSTORE_SOURCE_ID:
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
                allNewScrapedData.push(...scraperData);
                console.log(
                  `Successfully scraped ${scraperData.length} posts from new source ${platform.source_id} for ${targetName}`,
                );
              } else {
                console.warn(
                  `No data found for new source ${platform.source_id} and target: ${targetName}`,
                );
              }
            }

            if (allNewScrapedData.length === 0) {
              return reply.code(200).send({
                success: true,
                data: {
                  competitor,
                  added_sources: addedSources,
                },
                warning:
                  "Sources added successfully but no new data found from scraping. The company may not exist on the newly connected platforms.",
              });
            }

            console.log(`Total new scraped posts: ${allNewScrapedData.length}`);

            // Analyze new data with Gemini
            const analysisResult = await analyzeCompetitorData({
              dataset: allNewScrapedData,
            });

            const validatedResult =
              CompetitorAnalysisResponseSchema.parse(analysisResult);

            // Insert the new analysis data into the database
            const insertResponse = await insertCompetitorAnalysisData({
              userId: competitor.user_id,
              competitorId: competitor.competitor_id,
              analysisData: validatedResult,
            });

            console.log(`New analysis data inserted.`, insertResponse);

            return reply.code(200).send({
              success: true,
              data: {
                competitor,
                added_sources: addedSources,
              },
              analysis: {
                new_posts_scraped: allNewScrapedData.length,
                features_found: analysisResult.features?.length || 0,
                complaints_found: analysisResult.complaints?.length || 0,
                leads_found: analysisResult.leads?.length || 0,
                alternatives_found: analysisResult.alternatives?.length || 0,
              },
            });
          } catch (scrapingError: any) {
            console.error(
              "Error during new source scraping/analysis:",
              scrapingError,
            );

            return reply.code(200).send({
              success: true,
              data: {
                competitor,
                added_sources: addedSources,
              },
              warning: `Sources added successfully, but scraping/analysis failed: ${scrapingError.message}`,
            });
          }
        } catch (transactionError) {
          await client.query("ROLLBACK");
          throw transactionError;
        }
      } catch (error: any) {
        console.error("Error updating competitor sources:", error);

        // Handle unique constraint violation
        if (error.code === "23505") {
          return reply.code(409).send({
            error:
              "Duplicate source assignment - one or more sources are already connected to this competitor",
          });
        }

        // Handle foreign key constraint violation
        if (error.code === "23503") {
          return reply.code(400).send({
            error:
              "Invalid competitor_id or source_id: referenced record does not exist",
          });
        }

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
