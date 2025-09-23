import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import client from '../db';

interface SourceToggleBody {
  enabled: boolean;
}

interface SourceParams {
  id: string;
}

export default async function sourcesRoutes(fastify: FastifyInstance) {

  // Get all sources
  fastify.get('/api/sources', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = `
        SELECT 
          id,
          platform,
          enabled,
          last_scraped_at,
          created_at
        FROM public.sources
        ORDER BY created_at DESC
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

  // Toggle source enabled status
  fastify.patch<{ Params: SourceParams; Body: SourceToggleBody }>('/api/sources/:id/toggle', async (request: FastifyRequest<{ Params: SourceParams; Body: SourceToggleBody }>, reply: FastifyReply) => {
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
      const existingSource = await client.query(
        'SELECT id, enabled FROM public.sources WHERE id = $1',
        [id]
      );

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

      const result = await client.query(query, [enabled, id]);

      return {
        success: true,
        data: result.rows[0],
        message: `Source ${enabled ? 'enabled' : 'disabled'} successfully`
      };

    } catch (error: any) {
      console.error('Error toggling source status:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });
}