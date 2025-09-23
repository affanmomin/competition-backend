import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import client from '../db';

interface CompetitorBody {
  name: string;
  slug: string;
  user_id: string;
  source_ids?: string[]; // Array of source UUIDs to link to this competitor
}

interface CompetitorQuery {
  user_id?: string;
  limit?: string;
  offset?: string;
}

interface CompetitorParams {
  id: string;
}

interface DeleteCompetitorBody {
  user_id?: string;
}

export default async function competitorsRoutes(fastify: FastifyInstance) {

  // Add competitor
  fastify.post<{ Body: CompetitorBody }>('/api/competitors', async (request: FastifyRequest<{ Body: CompetitorBody }>, reply: FastifyReply) => {
    try {
      const { name, user_id, source_ids } = request.body;

      // Validate required fields
      if (!name  || !user_id) {
        return reply.code(400).send({
          error: 'Missing required fields: name and user_id are required'
        });
      }

         // Generate slug from name
      const slug = name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')     // Replace spaces with hyphens
        .replace(/[^\w\-]+/g, '') // Remove all non-word chars
        .replace(/\-\-+/g, '-');  // Replace multiple hyphens with ek hypehn

      // Start transaction
      await client.query('BEGIN');

      try {
        // Insert competitor
        const competitorQuery = `
          INSERT INTO public.competitors (name, slug, user_id)
          VALUES ($1, $2, $3)
          RETURNING *
        `;

        const competitorResult = await client.query(competitorQuery, [name, slug, user_id]);
        const competitor = competitorResult.rows[0];

        // Insert competitor_sources if source_ids are provided
          for (const source_id of source_ids) {
            const sourceQuery = `
              INSERT INTO public.competitor_sources (competitor_id, source_id)
              VALUES ($1, $2)
            `;
            await client.query(sourceQuery, [competitor.competitor_id, source_id]);
          }

        // Commit transaction
        await client.query('COMMIT');

        return reply.code(201).send({
          success: true,
          data: competitor
        });

      } catch (transactionError) {
        // Rollback transaction on error
        await client.query('ROLLBACK');
        throw transactionError;
      }

    } catch (error: any) {
      console.error('Error adding competitor:', error);
      
      // Handle unique constraint violation
      if (error.code === '23505') {
        return reply.code(409).send({
          error: 'Competitor with this slug already exists or duplicate source assignment'
        });
      }
      
      // Handle foreign key constraint violation
      if (error.code === '23503') {
        return reply.code(400).send({
          error: 'Invalid user_id or source_id: referenced record does not exist'
        });
      }

      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });

  // Get competitors
  fastify.get<{ Querystring: CompetitorQuery }>('/api/competitors', async (request: FastifyRequest<{ Querystring: CompetitorQuery }>, reply: FastifyReply) => {
    try {
      const { user_id, limit = '50', offset = '0' } = request.query;

      let query = 'SELECT * FROM public.competitors';
      const params: any[] = [];

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
      } else {
        query += ' LIMIT $1 OFFSET $2';
        params.push(parseInt(limit), parseInt(offset));
      }

      const result = await client.query(query, params);

      return {
        success: true,
        data: result.rows,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          count: result.rows.length
        }
      };

    } catch (error: any) {
      console.error('Error fetching competitors:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });

  // Get single competitor by ID
  fastify.get<{ Params: CompetitorParams }>('/api/competitors/:id', async (request: FastifyRequest<{ Params: CompetitorParams }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;

      const query = 'SELECT * FROM public.competitors WHERE id = $1';
      const result = await client.query(query, [id]);

      if (result.rows.length === 0) {
        return reply.code(404).send({
          error: 'Competitor not found'
        });
      }

      return {
        success: true,
        data: result.rows[0]
      };

    } catch (error: any) {
      console.error('Error fetching competitor:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });

  // Delete competitor
  fastify.delete<{ Params: CompetitorParams; Body: DeleteCompetitorBody }>('/api/competitors/:id', async (request: FastifyRequest<{ Params: CompetitorParams; Body: DeleteCompetitorBody }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const { user_id } = request.body || {};

      let query = 'DELETE FROM public.competitors WHERE competitor_id = $1';
      const params: any[] = [id];

      // If user_id is provided, ensure user can only delete their own competitors
      if (user_id) {
        query += ' AND user_id = $2';
        params.push(user_id);
      }

      query += ' RETURNING *';

      const result = await client.query(query, params);

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

    } catch (error: any) {
      console.error('Error deleting competitor:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });
}