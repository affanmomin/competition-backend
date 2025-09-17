import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { cardService } from '../services/card-service';
import { QueryParamsSchema, getAllQueryKeys } from '../services/query-registry';

const CardRequestSchema = z.object({
  queries: z.array(z.string()).min(1),
  user_id: z.string(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
});

export default async function cardRoutes(fastify: FastifyInstance) {
  // Get available card types
  fastify.get('/cards', async () => {
    return {
      available_cards: getAllQueryKeys()
    };
  });

  // Execute card queries
  fastify.post('/cards', {
    schema: {
      body: {
        type: 'object',
        required: ['queries', 'user_id'],
        properties: {
          queries: { type: 'array', items: { type: 'string' }, minItems: 1 },
          user_id: { type: 'string'},
          start_date: { type: 'string', format: 'date-time' },
          end_date: { type: 'string', format: 'date-time' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const body = CardRequestSchema.parse(request.body);
      const { queries, ...params } = body;

      // Validate query parameters
      const validatedParams = QueryParamsSchema.parse(params);

      // Execute queries
      const results = await cardService.executeQueries(queries, validatedParams);

      return {
        success: true,
        data: results
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      reply.status(400).send({
        success: false,
        error: errorMessage
      });
    }
  });
};
