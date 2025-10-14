/**
 * Fastify plugin for queue management endpoints
 */

import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { getQueueService } from "../services/queue-service";
import { testRedisConnection } from "../services/redis-service";

interface RunReportRequest {
  Body: {
    reportType: string;
    payload?: any;
    priority?: number;
  };
}

interface HealthResponse {
  status: "healthy" | "unhealthy";
  redis: boolean;
  queue: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: boolean;
  };
  timestamp: string;
}

const queuePlugin: FastifyPluginAsync = async (fastify) => {
  // Health check endpoint
  fastify.get<{ Reply: HealthResponse }>(
    "/queues/health",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const queueService = getQueueService();
        const redisHealthy = await testRedisConnection();
        const queueHealth = await queueService.getQueueHealth();

        const response: HealthResponse = {
          status: redisHealthy ? "healthy" : "unhealthy",
          redis: redisHealthy,
          queue: queueHealth,
          timestamp: new Date().toISOString(),
        };

        const statusCode = redisHealthy ? 200 : 503;
        return reply.status(statusCode).send(response);
      } catch (error) {
        fastify.log.error(
          "Health check failed: " +
            (error instanceof Error ? error.message : String(error)),
        );
        return reply.status(503).send({
          status: "unhealthy",
          redis: false,
          queue: {
            waiting: 0,
            active: 0,
            completed: 0,
            failed: 0,
            delayed: 0,
            paused: true,
          },
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  // Manual report trigger endpoint
  fastify.post<RunReportRequest>(
    "/queues/reports/run-now",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            reportType: { type: "string" },
            payload: { type: "object" },
            priority: { type: "number", minimum: 1, maximum: 10 },
          },
          required: ["reportType"],
        },
      },
    },
    async (request: FastifyRequest<RunReportRequest>, reply: FastifyReply) => {
      try {
        const { reportType, payload, priority } = request.body || {};

        if (!reportType) {
          return reply.status(400).send({
            error: "reportType is required",
            timestamp: new Date().toISOString(),
          });
        }

        const queueService = getQueueService();
        const job = await queueService.runReportNow(reportType, payload);

        return reply.status(202).send({
          message: "Report job queued successfully",
          jobId: job.id,
          reportType,
          priority: priority || 1,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error(
          "Failed to queue report job: " +
            (error instanceof Error ? error.message : String(error)),
        );
        return reply.status(500).send({
          error: "Failed to queue report job",
          details: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date().toISOString(),
        });
      }
    },
  );

  // Get queue status and recent jobs
  fastify.get(
    "/queues/status",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const queueService = getQueueService();
        const queueHealth = await queueService.getQueueHealth();
        const recentJobs = await queueService.getRecentJobs(20);

        return reply.send({
          health: queueHealth,
          recentJobs: recentJobs.map((job) => ({
            id: job.id,
            name: job.name,
            data: job.data,
            progress: job.progress,
            returnvalue: job.returnvalue,
            finishedOn: job.finishedOn,
            processedOn: job.processedOn,
            failedReason: job.failedReason,
            opts: {
              attempts: job.opts.attempts,
              priority: job.opts.priority,
              delay: job.opts.delay,
            },
          })),
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error(
          "Failed to get queue status: " +
            (error instanceof Error ? error.message : String(error)),
        );
        return reply.status(500).send({
          error: "Failed to get queue status",
          details: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date().toISOString(),
        });
      }
    },
  );

  // Get specific job details
  fastify.get<{ Params: { jobId: string } }>(
    "/queues/jobs/:jobId",
    async (
      request: FastifyRequest<{ Params: { jobId: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const { jobId } = request.params;
        const queueService = getQueueService();
        const queue = queueService.getQueue();
        const job = await queue.getJob(jobId);

        if (!job) {
          return reply.status(404).send({
            error: "Job not found",
            jobId,
            timestamp: new Date().toISOString(),
          });
        }

        return reply.send({
          id: job.id,
          name: job.name,
          data: job.data,
          progress: job.progress,
          returnvalue: job.returnvalue,
          finishedOn: job.finishedOn,
          processedOn: job.processedOn,
          failedReason: job.failedReason,
          stacktrace: job.stacktrace,
          opts: job.opts,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error(
          "Failed to get job details: " +
            (error instanceof Error ? error.message : String(error)),
        );
        return reply.status(500).send({
          error: "Failed to get job details",
          details: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date().toISOString(),
        });
      }
    },
  );
};

export default queuePlugin;
