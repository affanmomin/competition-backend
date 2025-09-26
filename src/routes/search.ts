import { FastifyInstance } from "fastify";
import { z } from "zod";
// import { performGoogleSearch } from "../google-search";

const searchQuerySchema = z.object({
  query: z.string().min(1).max(100),
});

export default async function searchRoutes(fastify: FastifyInstance) {
  fastify.post("/search", {
    schema: {
      body: {
        type: "object",
        required: ["query"],
        properties: {
          query: { type: "string" },
        },
      },
    },
    handler: async (request, reply) => {
      const { query } = searchQuerySchema.parse(request.body);

      try {
        // const results = await performGoogleSearch(query);
        // return { success: true, results };
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          success: false,
          error: "Failed to perform search",
        });
      }
    },
  });
}
