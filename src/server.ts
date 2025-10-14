import Fastify from "fastify";
import autoLoad from "@fastify/autoload";
import path from "node:path";
import queuePlugin from "./routes/queue";
import { getBullBoardService } from "./services/bull-board-service";

const server = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || "info",
  },
});

// Register CORS
server.register(require("@fastify/cors"), {
  origin: true,
  credentials: true,
});

// Register queue endpoints
server.register(queuePlugin);

// Register Bull Board UI (updated to v6.x for Fastify 5.x compatibility)
server.register(async (fastify) => {
  try {
    const bullBoardService = getBullBoardService();
    await bullBoardService.registerWithFastify(fastify);
  } catch (error) {
    fastify.log.warn(
      "Bull Board UI not available: " +
        (error instanceof Error ? error.message : String(error)),
    );
  }
});

server.register(autoLoad, {
  dir: path.join(__dirname, "routes"),
});

export default server;
