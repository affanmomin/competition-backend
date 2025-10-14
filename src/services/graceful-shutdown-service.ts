/**
 * Graceful shutdown service
 */

import { FastifyInstance } from "fastify";
import { shutdownQueueService } from "./queue-service";
import { closeRedisConnection } from "./redis-service";

export class GracefulShutdownService {
  private isShuttingDown = false;
  private shutdownHandlers: Array<() => Promise<void>> = [];

  constructor(private fastify: FastifyInstance) {
    this.setupSignalHandlers();
  }

  private setupSignalHandlers(): void {
    const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];

    signals.forEach((signal) => {
      process.on(signal, () => {
        this.fastify.log.info(
          `Received ${signal}, starting graceful shutdown...`,
        );
        this.shutdown(signal);
      });
    });

    // Handle uncaught exceptions
    process.on("uncaughtException", (error) => {
      this.fastify.log.error("Uncaught exception: " + error.message);
      this.shutdown("UNCAUGHT_EXCEPTION");
    });

    // Handle unhandled promise rejections
    process.on("unhandledRejection", (reason, promise) => {
      this.fastify.log.error(
        "Unhandled rejection at: " +
          String(promise) +
          " reason: " +
          String(reason),
      );
      this.shutdown("UNHANDLED_REJECTION");
    });
  }

  addShutdownHandler(handler: () => Promise<void>): void {
    this.shutdownHandlers.push(handler);
  }

  private async shutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      this.fastify.log.warn("Shutdown already in progress...");
      return;
    }

    this.isShuttingDown = true;
    const startTime = Date.now();

    try {
      this.fastify.log.info(`Starting graceful shutdown due to ${signal}...`);

      // Set a timeout for graceful shutdown
      const shutdownTimeout = setTimeout(() => {
        this.fastify.log.error("Graceful shutdown timeout, forcing exit");
        process.exit(1);
      }, 30000); // 30 seconds timeout

      // Run custom shutdown handlers first
      for (const handler of this.shutdownHandlers) {
        try {
          await handler();
        } catch (error) {
          this.fastify.log.error(
            "Error in custom shutdown handler: " +
              (error instanceof Error ? error.message : String(error)),
          );
        }
      }

      // Shutdown queue service
      this.fastify.log.info("Shutting down queue service...");
      await shutdownQueueService();

      // Close Redis connection
      this.fastify.log.info("Closing Redis connection...");
      await closeRedisConnection();

      // Close Fastify server
      this.fastify.log.info("Closing Fastify server...");
      await this.fastify.close();

      clearTimeout(shutdownTimeout);

      const shutdownTime = Date.now() - startTime;
      this.fastify.log.info(`Graceful shutdown completed in ${shutdownTime}ms`);

      process.exit(0);
    } catch (error) {
      this.fastify.log.error(
        "Error during graceful shutdown: " +
          (error instanceof Error ? error.message : String(error)),
      );
      process.exit(1);
    }
  }

  isShutdown(): boolean {
    return this.isShuttingDown;
  }
}

// Factory function to create and setup graceful shutdown
export function setupGracefulShutdown(
  fastify: FastifyInstance,
): GracefulShutdownService {
  const shutdownService = new GracefulShutdownService(fastify);

  // Add default handlers
  shutdownService.addShutdownHandler(async () => {
    fastify.log.info("Running custom cleanup tasks...");
    // Add any custom cleanup logic here
  });

  fastify.log.info("Graceful shutdown handlers registered");
  return shutdownService;
}
