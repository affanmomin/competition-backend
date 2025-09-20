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
exports.insertComplaintClusters = insertComplaintClusters;
exports.insertAlternatives = insertAlternatives;
exports.insertLeads = insertLeads;
exports.insertFeatures = insertFeatures;
exports.insertCompetitorAnalysisData = insertCompetitorAnalysisData;
const db_1 = __importDefault(require("../db"));
/**
 * Insert complaint clusters from Gemini analysis into the database
 */
function insertComplaintClusters(userId, competitorId, complaints) {
    return __awaiter(this, void 0, void 0, function* () {
        if (complaints.length === 0)
            return;
        const query = `
    INSERT INTO complaint_clusters (
      user_id,
      competitor_id,
      cluster,
      sample_post,
      frequency,
      evidence_ids,
      category,
      severity,
      sentiment_score,
      confidence_score,
      created_at,
      last_updated
    ) VALUES ${complaints.map((_, i) => `($${i * 10 + 1}, $${i * 10 + 2}, $${i * 10 + 3}, $${i * 10 + 4}, $${i * 10 + 5}, $${i * 10 + 6}, $${i * 10 + 7}, $${i * 10 + 8}, $${i * 10 + 9}, $${i * 10 + 10})`).join(', ')}
    ON CONFLICT (user_id, competitor_id, cluster) 
    DO UPDATE SET
      frequency = complaint_clusters.frequency + EXCLUDED.frequency,
      last_updated = NOW(),
      evidence_ids = EXCLUDED.evidence_ids,
      category = EXCLUDED.category,
      severity = EXCLUDED.severity,
      sentiment_score = EXCLUDED.sentiment_score,
      confidence_score = EXCLUDED.confidence_score
  `;
        const params = [];
        complaints.forEach(complaint => {
            params.push(userId, competitorId, complaint.canonical, complaint.canonical, // Using canonical as sample_post
            1, // frequency starts at 1
            JSON.stringify(complaint.evidence_ids), complaint.category || 'other', complaint.severity || 'medium', complaint.sentiment_score || -0.5, complaint.confidence_score || 0.8);
        });
        yield db_1.default.query(query, params);
    });
}
/**
 * Insert alternatives from Gemini analysis into the database
 */
function insertAlternatives(userId, competitorId, alternatives) {
    return __awaiter(this, void 0, void 0, function* () {
        if (alternatives.length === 0)
            return;
        const query = `
    INSERT INTO alternatives (
      user_id,
      competitor_id,
      name,
      mentions_count,
      evidence_ids,
      platform,
      mention_context,
      confidence_score,
      created_at,
      last_updated
    ) VALUES ${alternatives.map((_, i) => `($${i * 8 + 1}, $${i * 8 + 2}, $${i * 8 + 3}, $${i * 8 + 4}, $${i * 8 + 5}, $${i * 8 + 6}, $${i * 8 + 7}, $${i * 8 + 8})`).join(', ')}
    ON CONFLICT (user_id, competitor_id, name)
    DO UPDATE SET
      mentions_count = alternatives.mentions_count + EXCLUDED.mentions_count,
      last_updated = NOW(),
      evidence_ids = EXCLUDED.evidence_ids,
      platform = EXCLUDED.platform,
      mention_context = EXCLUDED.mention_context,
      confidence_score = EXCLUDED.confidence_score
  `;
        const params = [];
        alternatives.forEach(alternative => {
            params.push(userId, competitorId, alternative.name, 1, // mentions_count starts at 1
            JSON.stringify(alternative.evidence_ids), alternative.platform || 'unknown', alternative.mention_context || 'recommendation', alternative.confidence_score || 0.8);
        });
        yield db_1.default.query(query, params);
    });
}
/**
 * Insert leads from Gemini analysis into the database
 */
function insertLeads(userId, competitorId, leads) {
    return __awaiter(this, void 0, void 0, function* () {
        if (leads.length === 0)
            return;
        const query = `
    INSERT INTO leads (
      user_id,
      competitor_id,
      username,
      platform,
      excerpt,
      reason,
      lead_type,
      urgency,
      confidence_score,
      status,
      created_at,
      updated_at
    ) VALUES ${leads.map((_, i) => `($${i * 10 + 1}, $${i * 10 + 2}, $${i * 10 + 3}, $${i * 10 + 4}, $${i * 10 + 5}, $${i * 10 + 6}, $${i * 10 + 7}, $${i * 10 + 8}, $${i * 10 + 9}, $${i * 10 + 10})`).join(', ')}
    ON CONFLICT (user_id, username, platform, excerpt)
    DO UPDATE SET
      reason = EXCLUDED.reason,
      lead_type = EXCLUDED.lead_type,
      urgency = EXCLUDED.urgency,
      confidence_score = EXCLUDED.confidence_score,
      updated_at = NOW()
  `;
        const params = [];
        leads.forEach(lead => {
            params.push(userId, competitorId, lead.username, lead.platform, lead.excerpt, lead.reason, lead.lead_type || 'switching', lead.urgency || 'medium', lead.confidence_score || 0.8, 'new' // Default status
            );
        });
        yield db_1.default.query(query, params);
    });
}
/**
 * Insert features from Gemini analysis into the database
 * Note: This assumes a features table exists. If it doesn't exist, create it.
 */
function insertFeatures(userId, competitorId, features) {
    return __awaiter(this, void 0, void 0, function* () {
        if (features.length === 0)
            return;
        try {
            // First, try to create the features table if it doesn't exist
            const createTableQuery = `
      CREATE TABLE IF NOT EXISTS features (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        competitor_id INTEGER REFERENCES competitors(id),
        canonical VARCHAR(255) NOT NULL,
        evidence_ids JSONB,
        feature_type VARCHAR(50) DEFAULT 'new',
        impact_level VARCHAR(50) DEFAULT 'minor',
        confidence_score DECIMAL(3,2) DEFAULT 0.8,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        last_updated TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, competitor_id, canonical)
      );
    `;
            yield db_1.default.query(createTableQuery);
            const insertQuery = `
      INSERT INTO features (
        user_id,
        competitor_id,
        canonical,
        evidence_ids,
        feature_type,
        impact_level,
        confidence_score,
        created_at,
        last_updated
      ) VALUES ${features.map((_, i) => `($${i * 7 + 1}, $${i * 7 + 2}, $${i * 7 + 3}, $${i * 7 + 4}, $${i * 7 + 5}, $${i * 7 + 6}, $${i * 7 + 7})`).join(', ')}
      ON CONFLICT (user_id, competitor_id, canonical)
      DO UPDATE SET
        evidence_ids = EXCLUDED.evidence_ids,
        feature_type = EXCLUDED.feature_type,
        impact_level = EXCLUDED.impact_level,
        confidence_score = EXCLUDED.confidence_score,
        last_updated = NOW()
    `;
            const params = [];
            features.forEach(feature => {
                params.push(userId, competitorId, feature.canonical, JSON.stringify(feature.evidence_ids), feature.feature_type || 'new', feature.impact_level || 'minor', feature.confidence_score || 0.8);
            });
            yield db_1.default.query(insertQuery, params);
        }
        catch (error) {
            console.error('Error inserting features:', error);
            throw error;
        }
    });
}
/**
 * Insert all competitor analysis data into the database
 */
function insertCompetitorAnalysisData(request) {
    return __awaiter(this, void 0, void 0, function* () {
        const { userId, competitorId, analysisData } = request;
        try {
            // Begin transaction
            yield db_1.default.query('BEGIN');
            // Insert complaints
            if (analysisData.complaints && analysisData.complaints.length > 0) {
                yield insertComplaintClusters(userId, competitorId || null, analysisData.complaints);
            }
            // Insert alternatives
            if (analysisData.alternatives && analysisData.alternatives.length > 0) {
                yield insertAlternatives(userId, competitorId || null, analysisData.alternatives);
            }
            // Insert leads
            if (analysisData.leads && analysisData.leads.length > 0) {
                yield insertLeads(userId, competitorId || null, analysisData.leads);
            }
            // Insert features
            if (analysisData.features && analysisData.features.length > 0) {
                yield insertFeatures(userId, competitorId || null, analysisData.features);
            }
            // Commit transaction
            yield db_1.default.query('COMMIT');
        }
        catch (error) {
            // Rollback transaction on error
            yield db_1.default.query('ROLLBACK');
            console.error('Error inserting competitor analysis data:', error);
            throw error;
        }
    });
}
