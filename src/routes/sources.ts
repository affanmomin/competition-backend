import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import client from '../db';

export default async function sourcesRoutes(fastify: FastifyInstance) {

  // Get all sources
  fastify.get('/api/sources', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = `
        SELECT s.*, c.name as competitor_name, c.user_id
        FROM public.sources s
        LEFT JOIN public.competitors c ON c.competitor_id = s.competitor_id
        ORDER BY s.created_at DESC
      `;

      const result = await client.query(query);

      return {
        success: true,
        data: result.rows
      };

    } catch (error: any) {
      console.error('Error fetching sources:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });
}