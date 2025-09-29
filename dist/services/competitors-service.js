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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSlug = generateSlug;
exports.createCompetitorInDB = createCompetitorInDB;
exports.addCompetitorSources = addCompetitorSources;
exports.getExistingSourceIds = getExistingSourceIds;
exports.validateCompetitorAccess = validateCompetitorAccess;
exports.scrapeAndAnalyze = scrapeAndAnalyze;
const db_1 = __importDefault(require("../db"));
const competitors_1 = require("../constants/competitors");
const linkedin_scraper_1 = require("../linkedin-scraper");
const twitter_scraper_1 = require("../twitter-scraper");
const website_scraper_1 = require("../website-scraper");
const google_maps_scraper_1 = require("../google-maps-scraper");
const google_business_scraper_1 = require("../google-business-scraper");
const gemini_service_1 = require("./gemini-service");
const competitor_analysis_service_1 = require("./competitor-analysis-service");
const gemini_schemas_1 = require("../schemas/gemini-schemas");
/**
 * Generates a URL-friendly slug from a company name
 */
function generateSlug(name) {
    return name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^\w\-]+/g, "")
        .replace(/\-\-+/g, "-");
}
/**
 * Creates a competitor in the database with associated platform sources
 */
function createCompetitorInDB(name_1, user_id_1, platforms_1) {
    return __awaiter(this, arguments, void 0, function* (name, user_id, platforms, is_user = false) {
        const slug = generateSlug(name);
        yield db_1.default.query("BEGIN");
        try {
            // Insert competitor
            const competitorResult = yield db_1.default.query(`INSERT INTO public.competitors (name, slug, user_id, is_user)
       VALUES ($1, $2, $3, $4) RETURNING *`, [name, slug, user_id, is_user]);
            const competitor = competitorResult.rows[0];
            // Insert platform associations
            for (const platform of platforms) {
                yield db_1.default.query(`INSERT INTO public.competitor_sources (competitor_id, source_id, username)
         VALUES ($1, $2, $3)`, [
                    competitor.competitor_id,
                    platform.source_id,
                    platform.username || null,
                ]);
            }
            yield db_1.default.query("COMMIT");
            return competitor;
        }
        catch (error) {
            yield db_1.default.query("ROLLBACK");
            throw error;
        }
    });
}
/**
 * Adds new platform sources to an existing competitor
 */
function addCompetitorSources(competitor_id, platforms) {
    return __awaiter(this, void 0, void 0, function* () {
        yield db_1.default.query("BEGIN");
        try {
            const addedSources = [];
            for (const platform of platforms) {
                const result = yield db_1.default.query(`INSERT INTO public.competitor_sources (competitor_id, source_id, username)
         VALUES ($1, $2, $3) RETURNING *`, [competitor_id, platform.source_id, platform.username || null]);
                addedSources.push(result.rows[0]);
            }
            yield db_1.default.query("COMMIT");
            return addedSources;
        }
        catch (error) {
            yield db_1.default.query("ROLLBACK");
            throw error;
        }
    });
}
/**
 * Gets existing source IDs for a competitor to prevent duplicates
 */
function getExistingSourceIds(competitor_id) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield db_1.default.query(`SELECT source_id FROM public.competitor_sources WHERE competitor_id = $1`, [competitor_id]);
        return result.rows.map((row) => row.source_id);
    });
}
/**
 * Validates competitor ownership/access
 */
function validateCompetitorAccess(competitor_id, user_id) {
    return __awaiter(this, void 0, void 0, function* () {
        let query = "SELECT * FROM public.competitors WHERE competitor_id = $1";
        const params = [competitor_id];
        if (user_id) {
            query += " AND user_id = $2";
            params.push(user_id);
        }
        const result = yield db_1.default.query(query, params);
        if (result.rows.length === 0) {
            throw new Error(user_id
                ? "Competitor not found or you do not have permission to access it"
                : "Competitor not found");
        }
        return result.rows[0];
    });
}
/**
 * Scrapes data from a specific platform
 */
function scrapeFromPlatform(sourceId, targetName) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`Starting scraping for source ${sourceId}: ${targetName}`);
        switch (sourceId) {
            case competitors_1.PLATFORM_SOURCE_IDS.TWITTER:
                return yield (0, twitter_scraper_1.scrapeTwitterPosts)(targetName);
            case competitors_1.PLATFORM_SOURCE_IDS.LINKEDIN:
                return yield (0, linkedin_scraper_1.scrapeCompanyPosts)(targetName);
            case competitors_1.PLATFORM_SOURCE_IDS.WEBSITE:
                return yield (0, website_scraper_1.scrapeCompanyWebsite)(targetName);
            case competitors_1.PLATFORM_SOURCE_IDS.GOOGLE_MAPS:
                return yield (0, google_maps_scraper_1.scrapeGoogleMapsData)(targetName);
            case competitors_1.PLATFORM_SOURCE_IDS.GOOGLE_PLAYSTORE:
                return yield (0, google_business_scraper_1.scrapeGoogleBusinessData)(targetName);
            default:
                console.warn(`Unknown source ID: ${sourceId}`);
                return [];
        }
    });
}
/**
 * Scrapes data from multiple platforms and analyzes with AI
 */
function scrapeAndAnalyze(platforms, competitorName, user_id, competitor_id) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f;
        let allScrapedData = [];
        try {
            // Scrape data from all platforms
            for (const platform of platforms) {
                const targetName = platform.username || competitorName;
                const scraperData = yield scrapeFromPlatform(platform.source_id, targetName);
                if ((scraperData === null || scraperData === void 0 ? void 0 : scraperData.length) > 0) {
                    allScrapedData.push(...scraperData);
                    console.log(`Successfully scraped ${scraperData.length} posts from source ${platform.source_id} for ${targetName}`);
                }
                else {
                    console.warn(`No data found for source ${platform.source_id} and target: ${targetName}`);
                }
            }
            if (allScrapedData.length === 0) {
                return {
                    success: true,
                    data: [],
                    totalPosts: 0,
                    warning: "No data found from any source. Company may not exist on the specified platforms or scraping failed.",
                };
            }
            console.log(`Total scraped posts: ${allScrapedData.length}`);
            // Analyze with Gemini AI
            const analysisResult = yield (0, gemini_service_1.analyzeCompetitorData)({
                dataset: allScrapedData,
            });
            const validatedResult = gemini_schemas_1.CompetitorAnalysisResponseSchema.parse(analysisResult);
            // Insert analysis data into database
            yield (0, competitor_analysis_service_1.insertCompetitorAnalysisData)({
                userId: user_id,
                competitorId: competitor_id,
                analysisData: validatedResult,
            });
            console.log("Analysis data inserted successfully");
            return {
                success: true,
                data: allScrapedData,
                totalPosts: allScrapedData.length,
                analysis: {
                    posts_scraped: allScrapedData.length,
                    features_found: ((_a = analysisResult.features) === null || _a === void 0 ? void 0 : _a.length) || 0,
                    complaints_found: ((_b = analysisResult.complaints) === null || _b === void 0 ? void 0 : _b.length) || 0,
                    leads_found: ((_c = analysisResult.leads) === null || _c === void 0 ? void 0 : _c.length) || 0,
                    alternatives_found: ((_d = analysisResult.alternatives) === null || _d === void 0 ? void 0 : _d.length) || 0,
                },
            };
        }
        catch (error) {
            console.error("Error during scraping/analysis:", error);
            // Categorize errors for better user feedback
            if ((_e = error.message) === null || _e === void 0 ? void 0 : _e.includes("GEMINI_API_KEY")) {
                return {
                    success: false,
                    data: allScrapedData,
                    totalPosts: allScrapedData.length,
                    error: "Scraping completed but Gemini AI analysis failed due to missing API key.",
                };
            }
            if ((_f = error.message) === null || _f === void 0 ? void 0 : _f.includes("Gemini")) {
                return {
                    success: false,
                    data: allScrapedData,
                    totalPosts: allScrapedData.length,
                    error: "Scraping completed but Gemini AI analysis failed.",
                };
            }
            const platformErrors = [
                "Twitter",
                "LinkedIn",
                "website",
                "Google Maps",
                "Google Business",
            ];
            if (platformErrors.some((platform) => { var _a; return (_a = error.message) === null || _a === void 0 ? void 0 : _a.includes(platform); })) {
                return {
                    success: false,
                    data: [],
                    totalPosts: 0,
                    error: "Scraping failed. The company page may not exist or be accessible on the specified platforms.",
                };
            }
            return {
                success: false,
                data: [],
                totalPosts: 0,
                error: `Analysis failed: ${error.message}`,
            };
        }
    });
}
