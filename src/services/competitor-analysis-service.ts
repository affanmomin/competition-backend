import client from '../db';
import { GeminiAnalysisResponse } from './gemini-service';

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
  complaints: GeminiAnalysisResponse['complaints']
): Promise<void> {
  if (complaints.length === 0) return;

  const values = complaints.map(complaint => [
    competitorId,
    complaint.canonical,
    (complaint as any).platform || 'unknown',
    complaint.evidence_ids,
    new Date()
  ]);

  const query = `
    INSERT INTO public.complaints (
      competitor_id, canonical, platform, evidence_ids, last_updated
    ) 
    SELECT * FROM UNNEST($1::uuid[], $2::text[], $3::text[], $4::text[][], $5::timestamptz[])
  `;

  const [competitorIds, canonicals, platforms, evidenceIds, timestamps] = values.reduce(
    (acc, row) => {
      acc[0].push(row[0]);
      acc[1].push(row[1]);
      acc[2].push(row[2]);
      acc[3].push(row[3]);
      acc[4].push(row[4]);
      return acc;
    },
    [[], [], [], [], []]
  );

  await client.query(query, [competitorIds, canonicals, platforms, evidenceIds, timestamps]);
}

/**
 * Insert alternatives from Gemini analysis into the database
 */
export async function insertAlternatives(
  userId: string,
  competitorId: string | null,
  alternatives: GeminiAnalysisResponse['alternatives']
): Promise<void> {
  if (alternatives.length === 0) return;

  const values = alternatives.map(alternative => [
    userId,
    competitorId,
    alternative.name,
    1, // mentions_count starts at 1
    JSON.stringify(alternative.evidence_ids),
    alternative.platform || 'unknown',
    (alternative as any).mention_context || 'recommendation',
    (alternative as any).confidence_score || 0.8,
    new Date(),
    new Date()
  ]);

  const query = `
    INSERT INTO alternatives (
      user_id, competitor_id, name, mentions_count, evidence_ids, 
      platform, mention_context, confidence_score, created_at, last_updated
    ) 
    SELECT * FROM UNNEST(
      $1::text[], $2::uuid[], $3::text[], $4::integer[], $5::text[], 
      $6::text[], $7::text[], $8::decimal[], $9::timestamptz[], $10::timestamptz[]
    )
    ON CONFLICT (user_id, competitor_id, name)
    DO UPDATE SET
      mentions_count = alternatives.mentions_count + EXCLUDED.mentions_count,
      last_updated = NOW(),
      evidence_ids = EXCLUDED.evidence_ids,
      platform = EXCLUDED.platform,
      mention_context = EXCLUDED.mention_context,
      confidence_score = EXCLUDED.confidence_score
  `;

  const [userIds, competitorIds, names, mentionsCounts, evidenceIds, platforms, mentionContexts, confidenceScores, createdAts, lastUpdateds] = values.reduce(
    (acc, row) => {
      acc[0].push(row[0]);
      acc[1].push(row[1]);
      acc[2].push(row[2]);
      acc[3].push(row[3]);
      acc[4].push(row[4]);
      acc[5].push(row[5]);
      acc[6].push(row[6]);
      acc[7].push(row[7]);
      acc[8].push(row[8]);
      acc[9].push(row[9]);
      return acc;
    },
    [[], [], [], [], [], [], [], [], [], []]
  );

  await client.query(query, [userIds, competitorIds, names, mentionsCounts, evidenceIds, platforms, mentionContexts, confidenceScores, createdAts, lastUpdateds]);
}

/**
 * Insert leads from Gemini analysis into the database
 */
export async function insertLeads(
  userId: string,
  competitorId: string | null,
  leads: GeminiAnalysisResponse['leads']
): Promise<void> {
  if (leads.length === 0) return;

  const values = leads.map(lead => [
    userId,
    competitorId,
    lead.username,
    lead.platform,
    lead.excerpt,
    lead.reason,
    (lead as any).lead_type || 'switching',
    (lead as any).urgency || 'medium',
    (lead as any).confidence_score || 0.8,
    'new', // Default status
    new Date(),
    new Date()
  ]);

  const query = `
    INSERT INTO leads (
      user_id, competitor_id, username, platform, excerpt, reason, 
      lead_type, urgency, confidence_score, status, created_at, updated_at
    ) VALUES ?
    ON CONFLICT (user_id, username, platform, excerpt)
    DO UPDATE SET
      reason = EXCLUDED.reason,
      lead_type = EXCLUDED.lead_type,
      urgency = EXCLUDED.urgency,
      confidence_score = EXCLUDED.confidence_score,
      updated_at = NOW()
  `;

  await client.query(query, [values]);
}

/**
 * Insert features from Gemini analysis into the database
 * Note: This assumes a features table exists. If it doesn't exist, create it.
 */
export async function insertFeatures(
  userId: string,
  competitorId: string | null,
  features: GeminiAnalysisResponse['features']
): Promise<void> {
  if (features.length === 0) return;

  try {
  
    const values = features.map(feature => [
      userId,
      competitorId,
      feature.canonical,
      JSON.stringify(feature.evidence_ids),
      (feature as any).feature_type || 'new',
      (feature as any).impact_level || 'minor',
      (feature as any).confidence_score || 0.8,
      new Date(),
      new Date()
    ]);

    const insertQuery = `
      INSERT INTO features (
        user_id, competitor_id, canonical, evidence_ids, feature_type, 
        impact_level, confidence_score, created_at, last_updated
      ) VALUES ?
      ON CONFLICT (user_id, competitor_id, canonical)
      DO UPDATE SET
        evidence_ids = EXCLUDED.evidence_ids,
        feature_type = EXCLUDED.feature_type,
        impact_level = EXCLUDED.impact_level,
        confidence_score = EXCLUDED.confidence_score,
        last_updated = NOW()
    `;

    await client.query(insertQuery, [values]);
  } catch (error) {
    console.error('Error inserting features:', error);
    throw error;
  }
}

/**
 * Insert all competitor analysis data into the database
 */
export async function insertCompetitorAnalysisData(request: CompetitorAnalysisInsertRequest): Promise<void> {
  const { userId, competitorId, analysisData } = request;
  
  try {
    // Begin transaction
    await client.query('BEGIN');

    // Insert complaints
    if (analysisData.complaints && analysisData.complaints.length > 0) {
      await insertComplaints(userId, competitorId || null, analysisData.complaints);
    }

    // Insert alternatives
    if (analysisData.alternatives && analysisData.alternatives.length > 0) {
      await insertAlternatives(userId, competitorId || null, analysisData.alternatives);
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
    await client.query('COMMIT');
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    console.error('Error inserting competitor analysis data:', error);
    throw error;
  }
}