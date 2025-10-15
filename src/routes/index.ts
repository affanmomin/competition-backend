import type { FastifyPluginAsync, RouteHandlerMethod } from "fastify";
import searchRoutes from "./search";
import authRoutes from "./auth";
import cardRoutes from "./card";
import competitorsRoutes from "./competitors";
import sourcesRoutes from "./sources";
import geminiRoutes from "./gemini";
import leadsRoutes from "./leads";
import paymentRoutes from "./payments";

const register: FastifyPluginAsync = async (server, options) => {
  // Register sub-plugins/routes (all should be async-style too)
  await searchRoutes(server);
  await authRoutes(server);
  await cardRoutes(server);
  await competitorsRoutes(server);
  await sourcesRoutes(server);
  await geminiRoutes(server);
  await leadsRoutes(server);
  await paymentRoutes(server);

  const getStatus: RouteHandlerMethod = async (request, reply) => {
    return reply.status(200).send("API is live");
  };

  const successSchema = {};

  server.get("/", {
    schema: { response: { 200: successSchema } },
    handler: getStatus,
  });
};

export default register;
