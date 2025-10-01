import client from "../db";
import { PLATFORM_SOURCE_IDS } from "../constants/competitors";
import { scrapeCompanyPosts } from "../linkedin-scraper";
import { scrapeTwitterPosts } from "../twitter-scraper";
import { scrapeCompanyWebsite } from "../website-scraper";
import { scrapeGoogleMapsData } from "../google-maps-scraper";
import { scrapeGoogleBusinessData } from "../google-business-scraper";
import { scrapeGooglePlayStoreReviews } from "../google-play-store-scraper";
import { analyzeCompetitorData } from "./gemini-service";
import { insertCompetitorAnalysisData } from "./competitor-analysis-service";
import { CompetitorAnalysisResponseSchema } from "../schemas/gemini-schemas";
import type { PlatformData } from "../schemas/competitors";

export interface ScrapingResult {
  success: boolean;
  data: any[];
  totalPosts: number;
  analysis?: {
    posts_scraped: number;
    features_found: number;
    complaints_found: number;
    leads_found: number;
    alternatives_found: number;
  };
  warning?: string;
  error?: string;
}

/**
 * Generates a URL-friendly slug from a company name
 */
export function generateSlug(name: string): string {
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
export async function createCompetitorInDB(
  name: string,
  user_id: string,
  platforms: PlatformData[],
  is_user = false,
) {
  const slug = generateSlug(name);

  await client.query("BEGIN");
  try {
    // Insert competitor
    const competitorResult = await client.query(
      `INSERT INTO public.competitors (name, slug, user_id, is_user)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, slug, user_id, is_user],
    );

    const competitor = competitorResult.rows[0];

    // Insert platform associations
    for (const platform of platforms) {
      await client.query(
        `INSERT INTO public.competitor_sources (competitor_id, source_id, username)
         VALUES ($1, $2, $3)`,
        [
          competitor.competitor_id,
          platform.source_id,
          platform.username || null,
        ],
      );
    }

    await client.query("COMMIT");
    return competitor;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

/**
 * Adds new platform sources to an existing competitor
 */
export async function addCompetitorSources(
  competitor_id: string,
  platforms: PlatformData[],
) {
  await client.query("BEGIN");
  try {
    const addedSources = [];

    for (const platform of platforms) {
      const result = await client.query(
        `INSERT INTO public.competitor_sources (competitor_id, source_id, username)
         VALUES ($1, $2, $3) RETURNING *`,
        [competitor_id, platform.source_id, platform.username || null],
      );
      addedSources.push(result.rows[0]);
    }

    await client.query("COMMIT");
    return addedSources;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

/**
 * Gets existing source IDs for a competitor to prevent duplicates
 */
export async function getExistingSourceIds(
  competitor_id: string,
): Promise<string[]> {
  const result = await client.query(
    `SELECT source_id FROM public.competitor_sources WHERE competitor_id = $1`,
    [competitor_id],
  );
  return result.rows.map((row) => row.source_id);
}

/**
 * Validates competitor ownership/access
 */
export async function validateCompetitorAccess(
  competitor_id: string,
  user_id?: string,
) {
  let query = "SELECT * FROM public.competitors WHERE competitor_id = $1";
  const params: any[] = [competitor_id];

  if (user_id) {
    query += " AND user_id = $2";
    params.push(user_id);
  }

  const result = await client.query(query, params);
  if (result.rows.length === 0) {
    throw new Error(
      user_id
        ? "Competitor not found or you do not have permission to access it"
        : "Competitor not found",
    );
  }

  return result.rows[0];
}

/**
 * Scrapes data from a specific platform
 */
async function scrapeFromPlatform(
  sourceId: string,
  targetName: string,
): Promise<any[]> {
  console.log(`Starting scraping for source ${sourceId}: ${targetName}`);

  switch (sourceId) {
    case PLATFORM_SOURCE_IDS.TWITTER:
      return await scrapeTwitterPosts(targetName);
    case PLATFORM_SOURCE_IDS.LINKEDIN:
      return await scrapeCompanyPosts(targetName);
    case PLATFORM_SOURCE_IDS.WEBSITE:
      return await scrapeCompanyWebsite(targetName);
    case PLATFORM_SOURCE_IDS.GOOGLE_MAPS:
      return await scrapeGoogleMapsData(targetName);
    case PLATFORM_SOURCE_IDS.GOOGLE_PLAYSTORE:
      // For Play Store, expect a full URL passed as targetName when available
      if (targetName.startsWith("http")) {
        return await scrapeGooglePlayStoreReviews(targetName, {
          headless: false,
          maxReviews: 50,
        });
      }
      console.warn(
        "Play Store scraping expects platform.url to be provided; skipping.",
      );
      return [];
    default:
      console.warn(`Unknown source ID: ${sourceId}`);
      return [];
  }
}

/**
 * Scrapes data from multiple platforms and analyzes with AI
 */
export async function scrapeAndAnalyze(
  platforms: PlatformData[],
  competitorName: string,
  user_id: string,
  competitor_id: string,
): Promise<ScrapingResult> {
  let allScrapedData: any[] = [];

  try {
    // Scrape data from all platforms
    for (const platform of platforms) {
      const targetName = platform.username || competitorName;
      const scraperData = await scrapeFromPlatform(
        platform.source_id,
        targetName,
      );

      if (scraperData?.length > 0) {
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
      return {
        success: true,
        data: [],
        totalPosts: 0,
        warning:
          "No data found from any source. Company may not exist on the specified platforms or scraping failed.",
      };
    }

    console.log(`Total scraped posts: ${allScrapedData.length}`);

    // Analyze with Gemini AI
    const analysisResult = await analyzeCompetitorData({
      dataset: allScrapedData,
    });

    const validatedResult =
      CompetitorAnalysisResponseSchema.parse(analysisResult);

    // Insert analysis data into database
    await insertCompetitorAnalysisData({
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
        features_found: analysisResult.features?.length || 0,
        complaints_found: analysisResult.complaints?.length || 0,
        leads_found: analysisResult.leads?.length || 0,
        alternatives_found: analysisResult.alternatives?.length || 0,
      },
    };
  } catch (error: any) {
    console.error("Error during scraping/analysis:", error);

    // Categorize errors for better user feedback
    if (error.message?.includes("GEMINI_API_KEY")) {
      return {
        success: false,
        data: allScrapedData,
        totalPosts: allScrapedData.length,
        error:
          "Scraping completed but Gemini AI analysis failed due to missing API key.",
      };
    }

    if (error.message?.includes("Gemini")) {
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
    if (platformErrors.some((platform) => error.message?.includes(platform))) {
      return {
        success: false,
        data: [],
        totalPosts: 0,
        error:
          "Scraping failed. The company page may not exist or be accessible on the specified platforms.",
      };
    }

    return {
      success: false,
      data: [],
      totalPosts: 0,
      error: `Analysis failed: ${error.message}`,
    };
  }
}
