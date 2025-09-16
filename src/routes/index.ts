import type { FastifyPluginCallback, RouteHandlerMethod } from 'fastify';
import searchRoutes from './search';

const register: FastifyPluginCallback = async (server, options, done) => {
  // Register search routes
  await searchRoutes(server);
  const getStatus: RouteHandlerMethod = async (request, reply) => {
    return reply.status(200).send('API is live');
  };

  const successSchema = {};

  server.get('/', {
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
