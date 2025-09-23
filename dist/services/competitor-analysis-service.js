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
exports.insertComplaints = insertComplaints;
exports.insertAlternatives = insertAlternatives;
exports.insertLeads = insertLeads;
exports.insertFeatures = insertFeatures;
exports.insertCompetitorAnalysisData = insertCompetitorAnalysisData;
const db_1 = __importDefault(require("../db"));
/**
 * Insert complaints from Gemini analysis into the database
 */
function insertComplaints(userId, competitorId, complaints) {
    return __awaiter(this, void 0, void 0, function* () {
        if (complaints.length === 0)
            return;
        const query = `
    INSERT INTO public.complaints (
      competitor_id, canonical, platform, evidence_ids, last_updated
    ) VALUES ($1, $2, $3, $4, $5)
  `;
        for (const complaint of complaints) {
            yield db_1.default.query(query, [
                competitorId,
                complaint.canonical,
                complaint.platform || 'unknown',
                complaint.evidence_ids, // PostgreSQL driver will handle the array conversion
                new Date()
            ]);
        }
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
      user_id, competitor_id, name, platform, evidence_ids, mentions_count, last_updated
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
  `;
        for (const alternative of alternatives) {
            yield db_1.default.query(query, [
                userId,
                competitorId,
                alternative.name,
                alternative.platform || 'unknown',
                alternative.evidence_ids, // Don't JSON.stringify - keep as array
                1, // mentions_count starts at 1
                new Date()
            ]);
        }
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
      user_id, competitor_id, username, platform, excerpt, reason, 
      status, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `;
        for (const lead of leads) {
            yield db_1.default.query(query, [
                userId,
                competitorId,
                lead.username,
                lead.platform,
                lead.excerpt,
                lead.reason,
                'new',
                new Date()
            ]);
        }
    });
}
/**
 * Insert features from Gemini analysis into the database
 */
function insertFeatures(userId, competitorId, features) {
    return __awaiter(this, void 0, void 0, function* () {
        if (features.length === 0)
            return;
        const query = `
    INSERT INTO features (
      user_id, competitor_id, canonical, evidence_ids, feature_type, 
      impact_level, confidence_score, created_at, last_updated
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  `;
        for (const feature of features) {
            yield db_1.default.query(query, [
                userId,
                competitorId,
                feature.canonical,
                feature.evidence_ids,
                feature.feature_type || 'new',
                feature.impact_level || 'minor',
                feature.confidence_score || 0.8,
                new Date(),
                new Date()
            ]);
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
                yield insertComplaints(userId, competitorId || null, analysisData.complaints);
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
