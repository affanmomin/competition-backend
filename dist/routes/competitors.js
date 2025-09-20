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
exports.default = competitorsRoutes;
const db_1 = __importDefault(require("../db"));
function competitorsRoutes(fastify) {
    return __awaiter(this, void 0, void 0, function* () {
        // Add competitor
        fastify.post('/api/competitors', (request, reply) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { name, user_id } = request.body;
                // Validate required fields
                if (!name || !user_id) {
                    return reply.code(400).send({
                        error: 'Missing required fields: name and user_id are required'
                    });
                }
                // Generate slug from name
                const slug = name
                    .toLowerCase()
                    .trim()
                    .replace(/\s+/g, '-') // Replace spaces with hyphens
                    .replace(/[^\w\-]+/g, '') // Remove all non-word chars
                    .replace(/\-\-+/g, '-'); // Replace multiple hyphens with ek hypehn
                const query = `
        INSERT INTO public.competitors (name, slug, user_id)
        VALUES ($1, $2, $3)
        RETURNING *
      `;
                const result = yield db_1.default.query(query, [name, slug, user_id]);
                return reply.code(201).send({
                    success: true,
                    data: result.rows[0]
                });
            }
            catch (error) {
                console.error('Error adding competitor:', error);
                // Handle unique constraint violation
                if (error.code === '23505') {
                    return reply.code(409).send({
                        error: 'Competitor with this slug already exists'
                    });
                }
                // Handle foreign key constraint violation
                if (error.code === '23503') {
                    return reply.code(400).send({
                        error: 'Invalid user_id: user does not exist'
                    });
                }
                return reply.code(500).send({
                    error: 'Internal server error'
                });
            }
        }));
        // Get competitors
        fastify.get('/api/competitors', (request, reply) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { user_id, limit = '50', offset = '0' } = request.query;
                let query = 'SELECT * FROM public.competitors';
                const params = [];
                // Filter by user_id if provided
                if (user_id) {
                    query += ' WHERE user_id = $1';
                    params.push(user_id);
                }
                query += ' ORDER BY created_at DESC';
                // Add pagination
                if (user_id) {
                    query += ' LIMIT $2 OFFSET $3';
                    params.push(parseInt(limit), parseInt(offset));
                }
                else {
                    query += ' LIMIT $1 OFFSET $2';
                    params.push(parseInt(limit), parseInt(offset));
                }
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
                console.error('Error fetching competitors:', error);
                return reply.code(500).send({
                    error: 'Internal server error'
                });
            }
        }));
        // Get single competitor by ID
        fastify.get('/api/competitors/:id', (request, reply) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = request.params;
                const query = 'SELECT * FROM public.competitors WHERE id = $1';
                const result = yield db_1.default.query(query, [id]);
                if (result.rows.length === 0) {
                    return reply.code(404).send({
                        error: 'Competitor not found'
                    });
                }
                return {
                    success: true,
                    data: result.rows[0]
                };
            }
            catch (error) {
                console.error('Error fetching competitor:', error);
                return reply.code(500).send({
                    error: 'Internal server error'
                });
            }
        }));
        // Delete competitor
        fastify.delete('/api/competitors/:id', (request, reply) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = request.params;
                const { user_id } = request.body || {};
                let query = 'DELETE FROM public.competitors WHERE id = $1';
                const params = [id];
                // If user_id is provided, ensure user can only delete their own competitors
                if (user_id) {
                    query += ' AND user_id = $2';
                    params.push(user_id);
                }
                query += ' RETURNING *';
                const result = yield db_1.default.query(query, params);
                if (result.rows.length === 0) {
                    return reply.code(404).send({
                        error: 'Competitor not found or you do not have permission to delete it'
                    });
                }
                return {
                    success: true,
                    message: 'Competitor deleted successfully',
                    data: result.rows[0]
                };
            }
            catch (error) {
                console.error('Error deleting competitor:', error);
                return reply.code(500).send({
                    error: 'Internal server error'
                });
            }
        }));
    });
}
