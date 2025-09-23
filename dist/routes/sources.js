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
        // Get all sources
        fastify.get('/api/sources', (request, reply) => __awaiter(this, void 0, void 0, function* () {
            try {
                const query = `
        SELECT s.*, c.name as competitor_name, c.user_id
        FROM public.sources s
        LEFT JOIN public.competitors c ON c.competitor_id = s.competitor_id
        ORDER BY s.created_at DESC
      `;
                const result = yield db_1.default.query(query);
                return {
                    success: true,
                    data: result.rows
                };
            }
            catch (error) {
                console.error('Error fetching sources:', error);
                return reply.code(500).send({
                    error: 'Internal server error'
                });
            }
        }));
        // Toggle source enabled status
        fastify.patch('/api/sources/:id/toggle', (request, reply) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = request.params;
                const { enabled } = request.body;
                // Validate required fields
                if (enabled === undefined || enabled === null) {
                    return reply.code(400).send({
                        error: 'Missing required field: enabled is required'
                    });
                }
                // Check if source exists
                const existingSource = yield db_1.default.query('SELECT id, enabled FROM public.sources WHERE id = $1', [id]);
                if (existingSource.rows.length === 0) {
                    return reply.code(404).send({
                        error: 'Source not found'
                    });
                }
                // Update the enabled status
                const query = `
        UPDATE public.sources 
        SET enabled = $1
        WHERE id = $2
        RETURNING *
      `;
                const result = yield db_1.default.query(query, [enabled, id]);
                return {
                    success: true,
                    data: result.rows[0],
                    message: `Source ${enabled ? 'enabled' : 'disabled'} successfully`
                };
            }
            catch (error) {
                console.error('Error toggling source status:', error);
                return reply.code(500).send({
                    error: 'Internal server error'
                });
            }
        }));
    });
}
