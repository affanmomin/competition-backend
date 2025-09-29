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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = competitorsRoutes;
const db_1 = __importDefault(require("../db"));
const linkedin_scraper_1 = require("../linkedin-scraper");
const twitter_scraper_1 = require("../twitter-scraper");
const website_scraper_1 = require("../website-scraper");
const google_maps_scraper_1 = require("../google-maps-scraper");
const google_business_scraper_1 = require("../google-business-scraper");
const gemini_service_1 = require("../services/gemini-service");
const gemini_schemas_1 = require("../schemas/gemini-schemas");
const competitor_analysis_service_1 = require("../services/competitor-analysis-service");
function competitorsRoutes(fastify) {
    return __awaiter(this, void 0, void 0, function* () {
        // Add competitor
        fastify.post("/api/competitors", (request, reply) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { name, user_id, source_ids, platforms, is_user } = request.body;
                // Validate required fields
                if (!name || !user_id) {
                    return reply.code(400).send({
                        error: "Missing required fields: name and user_id are required",
                    });
                }
                // Handle both new platforms format and legacy source_ids format
                let platformsToProcess = [];
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
                }
                else if (source_ids && source_ids.length > 0) {
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
                yield db_1.default.query("BEGIN");
                try {
                    // Insert competitor
                    const competitorQuery = `
          INSERT INTO public.competitors (name, slug, user_id, is_user)
          VALUES ($1, $2, $3, $4)
          RETURNING *
        `;
                    const competitorResult = yield db_1.default.query(competitorQuery, [
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
                            yield db_1.default.query(sourceQuery, [
                                competitor.competitor_id,
                                platform.source_id,
                                platform.username || null,
                            ]);
                        }
                    }
                    // Commit transaction first to ensure competitor is saved
                    yield db_1.default.query("COMMIT");
                    // Now perform scraping and analysis based on platform data
                    try {
                        let allScrapedData = [];
                        const TWITTER_SOURCE_ID = "5d53c057-6e63-47c6-9301-192a3b9fa1d4";
                        const LINKEDIN_SOURCE_ID = "4a267045-dbfc-432c-96a5-17a9da542248";
                        const WEBSITE_SOURCE_ID = "da6acd0d-7b5e-4aec-8d0c-9126220a8341";
                        const GOOGLE_MAPS_SOURCE_ID = "8e7857f1-d153-4470-bd6a-cf4ad79bb8fe";
                        const GOOGLE_PLAYSTORE_SOURCE_ID = "4ee3988d-70a4-4dd4-8708-5441de698a38";
                        // Process each platform
                        for (const platform of platformsToProcess) {
                            let scraperData = [];
                            const targetName = platform.username || name; // Use platform username if available, fallback to company name
                            switch (platform.source_id) {
                                case TWITTER_SOURCE_ID:
                                    console.log(`Starting Twitter scraping for: ${targetName}`);
                                    scraperData = yield (0, twitter_scraper_1.scrapeTwitterPosts)(targetName);
                                    // Step 3: Analyze with Gemini
                                    const twitterAnalysisResult = yield (0, gemini_service_1.analyzeTwitterCompetitorData)({
                                        dataset: scraperData,
                                    });
                                    const validatedResult = gemini_schemas_1.CompetitorAnalysisResponseSchema.parse(twitterAnalysisResult);
                                    // Insert the analysis data into the database
                                    const insertResponse = yield (0, competitor_analysis_service_1.insertCompetitorAnalysisData)({
                                        userId: user_id,
                                        competitorId: competitor.competitor_id,
                                        analysisData: validatedResult,
                                    });
                                    console.log(`Analysis data inserted.`, insertResponse);
                                    break;
                                case LINKEDIN_SOURCE_ID:
                                    console.log(`Starting LinkedIn scraping for: ${targetName}`);
                                    scraperData = yield (0, linkedin_scraper_1.scrapeCompanyPosts)(targetName);
                                    // Step 3: Analyze with Gemini
                                    const linkedinAnalysisResult = yield (0, gemini_service_1.analyzeLinkedInCompetitorData)({
                                        dataset: scraperData,
                                    });
                                    const validatedLinkedinResult = gemini_schemas_1.CompetitorAnalysisResponseSchema.parse(linkedinAnalysisResult);
                                    // Insert the analysis data into the database
                                    const insertLinkedinResponse = yield (0, competitor_analysis_service_1.insertCompetitorAnalysisData)({
                                        userId: user_id,
                                        competitorId: competitor.competitor_id,
                                        analysisData: validatedLinkedinResult,
                                    });
                                    console.log(`Analysis data inserted.`, insertLinkedinResponse);
                                    break;
                                case WEBSITE_SOURCE_ID:
                                    console.log(`Starting website scraping for: ${targetName}`);
                                    scraperData = yield (0, website_scraper_1.scrapeCompanyWebsite)(targetName);
                                    const websiteAnalysisResult = yield (0, gemini_service_1.analyzeWebpageData)({
                                        dataset: scraperData,
                                    });
                                    const validatedWebsiteResult = gemini_schemas_1.CompetitorAnalysisResponseSchema.parse(websiteAnalysisResult);
                                    // Insert the analysis data into the database
                                    const insertWebsiteResponse = yield (0, competitor_analysis_service_1.insertCompetitorAnalysisData)({
                                        userId: user_id,
                                        competitorId: competitor.competitor_id,
                                        analysisData: validatedWebsiteResult,
                                    });
                                    console.log(`Analysis data inserted.`, insertWebsiteResponse);
                                    break;
                                case GOOGLE_MAPS_SOURCE_ID:
                                    console.log(`Starting Google Maps scraping for: ${targetName}`);
                                    scraperData = yield (0, google_maps_scraper_1.scrapeGoogleMapsData)(targetName);
                                    const googleMapsAnalysisResult = yield (0, gemini_service_1.analyzeGoogleMapsCompetitorData)({
                                        dataset: scraperData,
                                    });
                                    const validatedMapsResult = gemini_schemas_1.CompetitorAnalysisResponseSchema.parse(googleMapsAnalysisResult);
                                    // Insert the analysis data into the database
                                    const insertMapsResponse = yield (0, competitor_analysis_service_1.insertCompetitorAnalysisData)({
                                        userId: user_id,
                                        competitorId: competitor.competitor_id,
                                        analysisData: validatedMapsResult,
                                    });
                                    console.log(`Analysis data inserted.`, insertMapsResponse);
                                    break;
                                case GOOGLE_PLAYSTORE_SOURCE_ID:
                                    console.log(`Starting Google Business scraping for: ${targetName}`);
                                    scraperData = yield (0, google_business_scraper_1.scrapeGoogleBusinessData)(targetName);
                                    const googlePlaystoreAnalysisResult = yield (0, gemini_service_1.analyzePlayStoreCompetitorData)({
                                        dataset: scraperData,
                                    });
                                    const validatedPlaystoreResult = gemini_schemas_1.CompetitorAnalysisResponseSchema.parse(googlePlaystoreAnalysisResult);
                                    // Insert the analysis data into the database
                                    const insertPlaystoreResponse = yield (0, competitor_analysis_service_1.insertCompetitorAnalysisData)({
                                        userId: user_id,
                                        competitorId: competitor.competitor_id,
                                        analysisData: validatedPlaystoreResult,
                                    });
                                    console.log(`Analysis data inserted.`, insertPlaystoreResponse);
                                    break;
                                default:
                                    console.warn(`Unknown source ID: ${platform.source_id}`);
                                    continue;
                            }
                        }
                        return reply.code(200).send({
                            success: true,
                            data: competitor,
                        });
                    }
                    catch (scrapingError) {
                        // Log scraping errors but still return success since competitor was saved
                        console.error("Error during scraping/analysis:", scrapingError);
                        return reply.code(200).send({
                            success: true,
                            data: competitor,
                            warning: "Competitor added successfully, but scraping/analysis failed",
                        });
                    }
                }
                catch (transactionError) {
                    yield db_1.default.query("ROLLBACK");
                    throw transactionError;
                }
            }
            catch (error) {
                console.error("Error adding competitor:", error);
                if (error.code === "23505") {
                    return reply.code(409).send({
                        error: "Competitor with this slug already exists or duplicate source assignment",
                    });
                }
                // Handle foreign key constraint violation
                if (error.code === "23503") {
                    return reply.code(400).send({
                        error: "Invalid user_id or source_id: referenced record does not exist",
                    });
                }
                return reply.code(500).send({
                    error: "Internal server error",
                });
            }
        }));
        // Get competitors
        fastify.get("/api/competitors", (request, reply) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { user_id, limit = "50", offset = "0" } = request.query;
                let query = "SELECT * FROM public.competitors";
                const params = [];
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
                }
                else {
                    query += " LIMIT $1 OFFSET $2";
                    params.push(parseInt(limit), parseInt(offset));
                }
                const result = yield db_1.default.query(query, params);
                return {
                    success: true,
                    data: result.rows,
                    pagination: {
                        limit: parseInt(limit),
                        offset: parseInt(offset),
                        count: result.rows.length,
                    },
                };
            }
            catch (error) {
                console.error("Error fetching competitors:", error);
                return reply.code(500).send({
                    error: "Internal server error",
                });
            }
        }));
        // Get user competitors (is_user = true)
        fastify.get("/user/company", (request, reply) => __awaiter(this, void 0, void 0, function* () {
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
                const result = yield db_1.default.query(query, params);
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
                        const { competitor_source_id, source_id, username, source_created_at, source_updated_at, platform, enabled, last_scraped_at } = row, competitorData = __rest(row, ["competitor_source_id", "source_id", "username", "source_created_at", "source_updated_at", "platform", "enabled", "last_scraped_at"]);
                        competitorMap.set(competitorId, Object.assign(Object.assign({}, competitorData), { sources: [] }));
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
            }
            catch (error) {
                console.error("Error fetching user competitors:", error);
                return reply.code(500).send({
                    error: "Internal server error",
                });
            }
        }));
        // Get single competitor by ID
        fastify.get("/api/competitors/:id", (request, reply) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = request.params;
                // First get the competitor details
                const competitorQuery = "SELECT * FROM public.competitors WHERE competitor_id = $1";
                const competitorResult = yield db_1.default.query(competitorQuery, [id]);
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
                const sourcesResult = yield db_1.default.query(sourcesQuery, [id]);
                return {
                    success: true,
                    data: Object.assign(Object.assign({}, competitor), { sources: sourcesResult.rows }),
                };
            }
            catch (error) {
                console.error("Error fetching competitor:", error);
                return reply.code(500).send({
                    error: "Internal server error",
                });
            }
        }));
        // Update competitor sources (add new platform connections)
        fastify.post("/api/competitors/sources", (request, reply) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
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
                let competitorQuery = "SELECT * FROM public.competitors WHERE competitor_id = $1";
                const competitorParams = [competitor_id];
                if (user_id) {
                    competitorQuery += " AND user_id = $2";
                    competitorParams.push(user_id);
                }
                const competitorResult = yield db_1.default.query(competitorQuery, competitorParams);
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
                const existingSourcesResult = yield db_1.default.query(existingSourcesQuery, [
                    competitor_id,
                ]);
                const existingSourceIds = existingSourcesResult.rows.map((row) => row.source_id);
                // Filter out platforms that already exist
                const newPlatforms = platforms.filter((platform) => !existingSourceIds.includes(platform.source_id));
                if (newPlatforms.length === 0) {
                    return reply.code(409).send({
                        error: "All specified platforms are already connected to this competitor",
                        existing_sources: existingSourceIds,
                    });
                }
                // Start transaction for adding new sources
                yield db_1.default.query("BEGIN");
                try {
                    // Insert new platform associations
                    const addedSources = [];
                    for (const platform of newPlatforms) {
                        const sourceQuery = `
              INSERT INTO public.competitor_sources (competitor_id, source_id, username)
              VALUES ($1, $2, $3)
              RETURNING *
            `;
                        const result = yield db_1.default.query(sourceQuery, [
                            competitor_id,
                            platform.source_id,
                            platform.username || null,
                        ]);
                        addedSources.push(result.rows[0]);
                    }
                    // Commit the database changes
                    yield db_1.default.query("COMMIT");
                    // Now perform scraping and analysis for new platforms
                    try {
                        let allNewScrapedData = [];
                        const TWITTER_SOURCE_ID = "5d53c057-6e63-47c6-9301-192a3b9fa1d4";
                        const LINKEDIN_SOURCE_ID = "4a267045-dbfc-432c-96a5-17a9da542248";
                        const WEBSITE_SOURCE_ID = "da6acd0d-7b5e-4aec-8d0c-9126220a8341";
                        const GOOGLE_MAPS_SOURCE_ID = "8e7857f1-d153-4470-bd6a-cf4ad79bb8fe";
                        const GOOGLE_PLAYSTORE_SOURCE_ID = "4ee3988d-70a4-4dd4-8708-5441de698a38";
                        // Process each new platform
                        for (const platform of newPlatforms) {
                            let scraperData = [];
                            const targetName = platform.username || competitor.name;
                            switch (platform.source_id) {
                                case TWITTER_SOURCE_ID:
                                    console.log(`Starting Twitter scraping for: ${targetName}`);
                                    scraperData = yield (0, twitter_scraper_1.scrapeTwitterPosts)(targetName);
                                    break;
                                case LINKEDIN_SOURCE_ID:
                                    console.log(`Starting LinkedIn scraping for: ${targetName}`);
                                    scraperData = yield (0, linkedin_scraper_1.scrapeCompanyPosts)(targetName);
                                    break;
                                case WEBSITE_SOURCE_ID:
                                    console.log(`Starting website scraping for: ${targetName}`);
                                    scraperData = yield (0, website_scraper_1.scrapeCompanyWebsite)(targetName);
                                    break;
                                case GOOGLE_MAPS_SOURCE_ID:
                                    console.log(`Starting Google Maps scraping for: ${targetName}`);
                                    scraperData = yield (0, google_maps_scraper_1.scrapeGoogleMapsData)(targetName);
                                    break;
                                case GOOGLE_PLAYSTORE_SOURCE_ID:
                                    console.log(`Starting Google Business scraping for: ${targetName}`);
                                    scraperData = yield (0, google_business_scraper_1.scrapeGoogleBusinessData)(targetName);
                                    break;
                                default:
                                    console.warn(`Unknown source ID: ${platform.source_id}`);
                                    continue;
                            }
                            if (scraperData && scraperData.length > 0) {
                                allNewScrapedData.push(...scraperData);
                                console.log(`Successfully scraped ${scraperData.length} posts from new source ${platform.source_id} for ${targetName}`);
                            }
                            else {
                                console.warn(`No data found for new source ${platform.source_id} and target: ${targetName}`);
                            }
                        }
                        if (allNewScrapedData.length === 0) {
                            return reply.code(200).send({
                                success: true,
                                data: {
                                    competitor,
                                    added_sources: addedSources,
                                },
                                warning: "Sources added successfully but no new data found from scraping. The company may not exist on the newly connected platforms.",
                            });
                        }
                        console.log(`Total new scraped posts: ${allNewScrapedData.length}`);
                        // Analyze new data with Gemini
                        const analysisResult = yield (0, gemini_service_1.analyzeCompetitorData)({
                            dataset: allNewScrapedData,
                        });
                        const validatedResult = gemini_schemas_1.CompetitorAnalysisResponseSchema.parse(analysisResult);
                        // Insert the new analysis data into the database
                        const insertResponse = yield (0, competitor_analysis_service_1.insertCompetitorAnalysisData)({
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
                                features_found: ((_a = analysisResult.features) === null || _a === void 0 ? void 0 : _a.length) || 0,
                                complaints_found: ((_b = analysisResult.complaints) === null || _b === void 0 ? void 0 : _b.length) || 0,
                                leads_found: ((_c = analysisResult.leads) === null || _c === void 0 ? void 0 : _c.length) || 0,
                                alternatives_found: ((_d = analysisResult.alternatives) === null || _d === void 0 ? void 0 : _d.length) || 0,
                            },
                        });
                    }
                    catch (scrapingError) {
                        console.error("Error during new source scraping/analysis:", scrapingError);
                        return reply.code(200).send({
                            success: true,
                            data: {
                                competitor,
                                added_sources: addedSources,
                            },
                            warning: `Sources added successfully, but scraping/analysis failed: ${scrapingError.message}`,
                        });
                    }
                }
                catch (transactionError) {
                    yield db_1.default.query("ROLLBACK");
                    throw transactionError;
                }
            }
            catch (error) {
                console.error("Error updating competitor sources:", error);
                // Handle unique constraint violation
                if (error.code === "23505") {
                    return reply.code(409).send({
                        error: "Duplicate source assignment - one or more sources are already connected to this competitor",
                    });
                }
                // Handle foreign key constraint violation
                if (error.code === "23503") {
                    return reply.code(400).send({
                        error: "Invalid competitor_id or source_id: referenced record does not exist",
                    });
                }
                return reply.code(500).send({
                    error: "Internal server error",
                });
            }
        }));
        // Delete competitor
        fastify.delete("/api/competitors/:id", (request, reply) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = request.params;
                const { user_id } = request.body || {};
                let query = "DELETE FROM public.competitors WHERE competitor_id = $1";
                const params = [id];
                // If user_id is provided, ensure user can only delete their own competitors
                if (user_id) {
                    query += " AND user_id = $2";
                    params.push(user_id);
                }
                query += " RETURNING *";
                const result = yield db_1.default.query(query, params);
                if (result.rows.length === 0) {
                    return reply.code(404).send({
                        error: "Competitor not found or you do not have permission to delete it",
                    });
                }
                return {
                    success: true,
                    message: "Competitor deleted successfully",
                    data: result.rows[0],
                };
            }
            catch (error) {
                console.error("Error deleting competitor:", error);
                return reply.code(500).send({
                    error: "Internal server error",
                });
            }
        }));
    });
}
