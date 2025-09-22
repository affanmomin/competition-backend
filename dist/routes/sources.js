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
exports.default = sourcesRoutes;
const db_1 = __importDefault(require("../db"));
function sourcesRoutes(fastify) {
    return __awaiter(this, void 0, void 0, function* () {
        // Get sources with filtering
        fastify.get('/api/sources', (request, reply) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { competitor_id, user_id, platform, enabled, limit = '50', offset = '0' } = request.query;
                let query = `
        SELECT s.*, c.name as competitor_name, c.user_id
        FROM public.sources s
        LEFT JOIN public.competitors c ON c.competitor_id = s.competitor_id
      `;
                const params = [];
                const conditions = [];
                // Filter by competitor_id if provided
                if (competitor_id) {
                    conditions.push(`s.competitor_id = $${params.length + 1}`);
                    params.push(competitor_id);
                }
                // Filter by user_id through competitor relationship
                if (user_id) {
                    conditions.push(`c.user_id = $${params.length + 1}`);
                    params.push(user_id);
                }
                // Filter by platform if provided
                if (platform) {
                    conditions.push(`s.platform = $${params.length + 1}`);
                    params.push(platform);
                }
                // Filter by enabled status if provided
                if (enabled !== undefined) {
                    const enabledBool = enabled === 'true';
                    conditions.push(`s.enabled = $${params.length + 1}`);
                    params.push(enabledBool);
                }
                // Add WHERE clause if there are conditions
                if (conditions.length > 0) {
                    query += ` WHERE ${conditions.join(' AND ')}`;
                }
                query += ' ORDER BY s.created_at DESC';
                // Add pagination
                query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
                params.push(parseInt(limit), parseInt(offset));
                const result = yield db_1.default.query(query, params);
                return {
                    success: true,
                    data: result.rows,
                    pagination: {
                        limit: parseInt(limit),
                        offset: parseInt(offset),
                        count: result.rows.length
                    }
                };
            }
            catch (error) {
                console.error('Error fetching sources:', error);
                return reply.code(500).send({
                    error: 'Internal server error'
                });
            }
        }));
        // Get single source by ID
        fastify.get('/api/sources/:id', (request, reply) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = request.params;
                const query = `
        SELECT s.*, c.name as competitor_name, c.user_id
        FROM public.sources s
        LEFT JOIN public.competitors c ON c.competitor_id = s.competitor_id
        WHERE s.id = $1
      `;
                const result = yield db_1.default.query(query, [id]);
                if (result.rows.length === 0) {
                    return reply.code(404).send({
                        error: 'Source not found'
                    });
                }
                return {
                    success: true,
                    data: result.rows[0]
                };
            }
            catch (error) {
                console.error('Error fetching source:', error);
                return reply.code(500).send({
                    error: 'Internal server error'
                });
            }
        }));
        // Create new source
        fastify.post('/api/sources', (request, reply) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { competitor_id, platform, enabled = true } = request.body;
                // Validate required fields
                if (!competitor_id || !platform) {
                    return reply.code(400).send({
                        error: 'Missing required fields: competitor_id and platform are required'
                    });
                }
                // Validate platform enum
                const validPlatforms = ['reddit', 'twitter', 'g2', 'ph', 'hn', 'linkedin'];
                if (!validPlatforms.includes(platform)) {
                    return reply.code(400).send({
                        error: `Invalid platform. Must be one of: ${validPlatforms.join(', ')}`
                    });
                }
                // Check if competitor exists
                const competitorCheck = yield db_1.default.query('SELECT competitor_id FROM public.competitors WHERE competitor_id = $1', [competitor_id]);
                if (competitorCheck.rows.length === 0) {
                    return reply.code(400).send({
                        error: 'Competitor not found'
                    });
                }
                // Check if source already exists for this competitor and platform
                const existingSource = yield db_1.default.query('SELECT id FROM public.sources WHERE competitor_id = $1 AND platform = $2', [competitor_id, platform]);
                if (existingSource.rows.length > 0) {
                    return reply.code(400).send({
                        error: 'Source already exists for this competitor and platform'
                    });
                }
                const query = `
        INSERT INTO public.sources (competitor_id, platform, enabled)
        VALUES ($1, $2, $3)
        RETURNING *
      `;
                const result = yield db_1.default.query(query, [competitor_id, platform, enabled]);
                return {
                    success: true,
                    data: result.rows[0]
                };
            }
            catch (error) {
                console.error('Error creating source:', error);
                return reply.code(500).send({
                    error: 'Internal server error'
                });
            }
        }));
        // Update source
        fastify.put('/api/sources/:id', (request, reply) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = request.params;
                const { enabled, last_scraped_at } = request.body;
                // Check if source exists
                const existingSource = yield db_1.default.query('SELECT id FROM public.sources WHERE id = $1', [id]);
                if (existingSource.rows.length === 0) {
                    return reply.code(404).send({
                        error: 'Source not found'
                    });
                }
                const updates = [];
                const params = [];
                if (enabled !== undefined) {
                    updates.push(`enabled = $${params.length + 1}`);
                    params.push(enabled);
                }
                if (last_scraped_at !== undefined) {
                    updates.push(`last_scraped_at = $${params.length + 1}`);
                    params.push(last_scraped_at);
                }
                if (updates.length === 0) {
                    return reply.code(400).send({
                        error: 'No fields to update'
                    });
                }
                const query = `
        UPDATE public.sources 
        SET ${updates.join(', ')}
        WHERE id = $${params.length + 1}
        RETURNING *
      `;
                params.push(id);
                const result = yield db_1.default.query(query, params);
                return {
                    success: true,
                    data: result.rows[0]
                };
            }
            catch (error) {
                console.error('Error updating source:', error);
                return reply.code(500).send({
                    error: 'Internal server error'
                });
            }
        }));
        // Delete source
        fastify.delete('/api/sources/:id', (request, reply) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = request.params;
                // Check if source exists
                const existingSource = yield db_1.default.query('SELECT id FROM public.sources WHERE id = $1', [id]);
                if (existingSource.rows.length === 0) {
                    return reply.code(404).send({
                        error: 'Source not found'
                    });
                }
                const query = 'DELETE FROM public.sources WHERE id = $1 RETURNING *';
                const result = yield db_1.default.query(query, [id]);
                return {
                    success: true,
                    data: result.rows[0],
                    message: 'Source deleted successfully'
                };
            }
            catch (error) {
                console.error('Error deleting source:', error);
                return reply.code(500).send({
                    error: 'Internal server error'
                });
            }
        }));
    });
}
