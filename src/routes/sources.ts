import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import client from '../db';

interface SourceToggleBody {
  enabled: boolean;
}

interface SourceParams {
  id: string;
}

interface CompetitorSourceParams {
  competitorId: string;
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

  // Get sources by competitor ID
  fastify.get<{ Params: CompetitorSourceParams }>('/api/competitors/:competitorId/sources', async (request: FastifyRequest<{ Params: CompetitorSourceParams }>, reply: FastifyReply) => {
    try {
      const { competitorId } = request.params;

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(competitorId)) {
        return reply.code(400).send({
          error: 'Invalid competitor ID format'
        });
      }

      // Check if competitor exists
      const competitorExists = await client.query(
        'SELECT competitor_id FROM public.competitors WHERE competitor_id = $1',
        [competitorId]
      );

      if (competitorExists.rows.length === 0) {
        return reply.code(404).send({
          error: 'Competitor not found'
        });
      }

      const query = `
        SELECT 
          s.id,
          s.platform,
          s.enabled,
          s.last_scraped_at,
          s.created_at,
          cs.created_at as linked_at,
          cs.updated_at as link_updated_at
        FROM public.sources s
        INNER JOIN public.competitor_sources cs ON cs.source_id = s.id
        WHERE cs.competitor_id = $1
        ORDER BY cs.created_at DESC
      `;

      const result = await client.query(query, [competitorId]);

      return {
        success: true,
        data: result.rows,
        competitor_id: competitorId
      };

    } catch (error: any) {
      console.error('Error fetching sources for competitor:', error);
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