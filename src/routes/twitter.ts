import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import path from "path";
import { TwitterService, TwitterConfigSchema } from "../services/twitter-service";

const twitterRoutes: FastifyPluginAsync = async (fastify) => {
  // Schema for request body validation
  const ScrapeRequestSchema = TwitterConfigSchema.omit({
    outputDir: true
  }).extend({
    outputDir: z.string().optional()
  });

  fastify.post<{ Body: z.infer<typeof ScrapeRequestSchema> }>(
    "/scrape",
    {
      schema: {
        body: {
          type: "object",
          required: ["username", "password", "targetProfile"],
          properties: {
            username: { type: "string" },
            password: { type: "string" },
            targetProfile: { type: "string" },
            tweetLimit: { type: "number", default: 20 },
            commentLimit: { type: "number", default: 20 },
            outputDir: { type: "string" }
          }
        }
      }
    },
    async (request, reply) => {
      try {
        const config = {
          ...request.body,
          outputDir: request.body.outputDir ?? path.join(process.cwd(), "tmp")
        };

        const twitterService = new TwitterService(config);
        const results = await twitterService.scrapeTweets();
        return { success: true, data: results };
      } catch (error) {
        fastify.log.error(error);
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            success: false,
            error: "Invalid request data",
            details: error.errors
          });
        }
        return reply.status(500).send({
          success: false,
          error: "Failed to scrape tweets"
        });
      }
    }
  );
};

export default twitterRoutes;
