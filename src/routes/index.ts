import type { FastifyPluginCallback, RouteHandlerMethod } from "fastify";
import searchRoutes from "./search";
import twitterRoutes from "./twitter";
import authRoutes from "./auth";
import cardRoutes from "./card";
import competitorsRoutes from "./competitors";
import sourcesRoutes from "./sources";
import geminiRoutes from "./gemini";

const register: FastifyPluginCallback = async (server, options, done) => {
  // Register search routes
  await searchRoutes(server);
  await twitterRoutes(server, {});
  await authRoutes(server);
  await cardRoutes(server);
  await competitorsRoutes(server);
  await sourcesRoutes(server);
  await geminiRoutes(server);
  const getStatus: RouteHandlerMethod = async (request, reply) => {
    return reply.status(200).send("API is live");
  };

  const successSchema = {};

  server.get("/", {
    schema: {
      response: {
        200: successSchema,
      },
    },
    handler: getStatus,
  });

  done();
};

export default register;
