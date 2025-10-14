import server from "./server";
import client from "./db";
import { setupGracefulShutdown } from "./services/graceful-shutdown-service";
import { getQueueService } from "./services/queue-service";

const port = Number(process.env.PORT) || 3000;

// Initialize queue service early (creates connection)
try {
  getQueueService();
  server.log.info("Queue service initialized");
} catch (error) {
  server.log.warn(
    "Queue service not available - Redis/BullMQ dependencies not installed",
  );
}

// Setup graceful shutdown
const shutdownService = setupGracefulShutdown(server);

// Add custom shutdown handler for database
shutdownService.addShutdownHandler(async () => {
  try {
    await client.end();
    server.log.info("Database connection closed");
  } catch (error) {
    server.log.error("Error closing database connection");
  }
});

server.listen(
  {
    port,
    host: "0.0.0.0",
  },
  (err, address) => {
    if (err) {
      server.log.error(err);
      process.exit(1);
    }

    server.log.info(`Server running on ${address}`);
    server.log.info("Queue management UI available at /admin/queues");
    server.log.info("Queue health check available at /queues/health");
    server.log.info(
      "Manual report trigger available at POST /queues/reports/run-now",
    );
  },
);

async function connectDB() {
  try {
    await client.connect();
    console.log("Connected to Supabase PostgreSQL!");
  } catch (err) {
    console.error("Connection error:", err);
  }
}

connectDB();
