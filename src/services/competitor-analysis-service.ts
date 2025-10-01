import client from "../db";
import { GeminiAnalysisResponse } from "./gemini-service";

export interface CompetitorAnalysisInsertRequest {
  userId: string;
  competitorId?: string;
  analysisData: GeminiAnalysisResponse;
}

/**
 * Insert complaints from Gemini analysis into the database
 */
export async function insertComplaints(
  userId: string,
  competitorId: string | null,
  complaints: GeminiAnalysisResponse["complaints"],
): Promise<void> {
  if (complaints.length === 0) return;

  const query = `
    INSERT INTO public.complaints (
      competitor_id, canonical, platform, evidence_ids, last_updated
    ) VALUES ($1, $2, $3, $4, $5)
  `;

  for (const complaint of complaints) {
    await client.query(query, [
      competitorId,
      complaint.canonical,
      (complaint as any).platform || "unknown",
      complaint.evidence_ids, // PostgreSQL driver will handle the array conversion
      new Date(),
    ]);
  }
}

/**
 * Insert alternatives from Gemini analysis into the database
 */
export async function insertAlternatives(
  userId: string,
  competitorId: string | null,
  alternatives: GeminiAnalysisResponse["alternatives"],
): Promise<void> {
  if (alternatives.length === 0) return;

  const query = `
    INSERT INTO alternatives (
      user_id, competitor_id, name, platform, evidence_ids, mentions_count, last_updated
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
  `;

  for (const alternative of alternatives) {
    await client.query(query, [
      userId,
      competitorId,
      alternative.name,
      alternative.platform || "unknown",
      alternative.evidence_ids, // Don't JSON.stringify - keep as array
      1, // mentions_count starts at 1
      new Date(),
    ]);
  }
}

/**
 * Insert leads from Gemini analysis into the database
 */
export async function insertLeads(
  userId: string,
  competitorId: string | null,
  leads: GeminiAnalysisResponse["leads"],
): Promise<void> {
  if (leads.length === 0) return;

  const query = `
    INSERT INTO leads (
      user_id, competitor_id, username, platform, excerpt, reason, 
      status, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `;

  for (const lead of leads) {
    await client.query(query, [
      userId,
      competitorId,
      lead.username,
      lead.platform,
      lead.excerpt,
      lead.reason,
      "new",
      new Date(),
    ]);
  }
}

/**
 * Insert features from Gemini analysis into the database
 */
export async function insertFeatures(
  userId: string,
  competitorId: string | null,
  features: GeminiAnalysisResponse["features"],
): Promise<void> {
  if (features.length === 0) return;

  const query = `
    INSERT INTO features (
      user_id, competitor_id, canonical, evidence_ids, feature_type, 
      impact_level, confidence_score, created_at, last_updated
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  `;

  for (const feature of features) {
    await client.query(query, [
      userId,
      competitorId,
      feature.canonical,
      feature.evidence_ids,
      (feature as any).feature_type || "new",
      (feature as any).impact_level || "minor",
      (feature as any).confidence_score || 0.8,
      new Date(),
      new Date(),
    ]);
  }
}

/**
 * Insert all competitor analysis data into the database
 */
export async function insertCompetitorAnalysisData(
  request: CompetitorAnalysisInsertRequest,
): Promise<void> {
  const { userId, competitorId, analysisData } = request;

  try {
    // Begin transaction
    await client.query("BEGIN");

    // Insert complaints
    if (analysisData.complaints && analysisData.complaints.length > 0) {
      await insertComplaints(
        userId,
        competitorId || null,
        analysisData.complaints,
      );
    }

    // Insert alternatives
    if (analysisData.alternatives && analysisData.alternatives.length > 0) {
      await insertAlternatives(
        userId,
        competitorId || null,
        analysisData.alternatives,
      );
    }

    // Insert leads
    if (analysisData.leads && analysisData.leads.length > 0) {
      await insertLeads(userId, competitorId || null, analysisData.leads);
    }

    // Insert features
    if (analysisData.features && analysisData.features.length > 0) {
      await insertFeatures(userId, competitorId || null, analysisData.features);
    }

    // Commit transaction
    await client.query("COMMIT");
  } catch (error) {
    // Rollback transaction on error
    await client.query("ROLLBACK");
    console.error("Error inserting competitor analysis data:", error);
    throw error;
  }
}
