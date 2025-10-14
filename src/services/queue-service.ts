/**
 * BullMQ service for managing queues, workers, and scheduled jobs
 */

import { Queue, Worker, QueueEvents, Job } from "bullmq";
import { getRedisClient } from "./redis-service";

export interface QueueJobData {
  type: string;
  payload?: any;
  timestamp?: number;
}

export interface ReportsJobData extends QueueJobData {
  type: "report-generation";
  reportType: string;
  filters?: any;
}

export class QueueService {
  private queue: Queue;
  private worker: Worker;
  private queueEvents: QueueEvents;
  private isShuttingDown = false;

  constructor() {
    const connection = getRedisClient();

    // Initialize Queue
    this.queue = new Queue("reports", {
      connection,
      defaultJobOptions: {
        removeOnComplete: { age: 24 * 3600, count: 10 },
        removeOnFail: { age: 24 * 3600, count: 5 },
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
      },
    });

    // Initialize Worker
    this.worker = new Worker(
      "reports",
      async (job: Job<ReportsJobData>) => {
        return this.processJob(job);
      },
      {
        connection,
        concurrency: 5,
      },
    );

    // Initialize Queue Events
    this.queueEvents = new QueueEvents("reports", {
      connection,
    });

    this.setupEventListeners();
    this.setupRepeatableJobs();
  }

  private setupEventListeners(): void {
    this.worker.on("completed", (job: Job) => {
      console.log(`Job ${job.id} completed successfully`);
    });

    this.worker.on("failed", (job: Job | undefined, err: Error) => {
      console.error(`Job ${job?.id} failed:`, err);
    });

    this.worker.on("error", (err: Error) => {
      console.error("Worker error:", err);
    });

    this.queueEvents.on("waiting", ({ jobId }: any) => {
      console.log(`Job ${jobId} is waiting`);
    });

    this.queueEvents.on("active", ({ jobId }: any) => {
      console.log(`Job ${jobId} is active`);
    });

    this.queueEvents.on("stalled", ({ jobId }: any) => {
      console.log(`Job ${jobId} stalled`);
    });
  }

  private async setupRepeatableJobs(): Promise<void> {
    try {
      // Daily report generation at 9 AM IST
      await this.queue.add(
        "daily-report",
        {
          type: "report-generation",
          reportType: "daily",
          timestamp: Date.now(),
        },
        {
          repeat: {
            pattern: "0 9 * * *", // 9 AM every day
            tz: "Asia/Kolkata",
          },
          jobId: "daily-report-cron",
        },
      );

      // Weekly report generation on Mondays at 10 AM IST
      await this.queue.add(
        "weekly-report",
        {
          type: "report-generation",
          reportType: "weekly",
          timestamp: Date.now(),
        },
        {
          repeat: {
            pattern: "0 10 * * 1", // 10 AM every Monday
            tz: "Asia/Kolkata",
          },
          jobId: "weekly-report-cron",
        },
      );

      // Monthly report generation on 1st of each month at 11 AM IST
      await this.queue.add(
        "monthly-report",
        {
          type: "report-generation",
          reportType: "monthly",
          timestamp: Date.now(),
        },
        {
          repeat: {
            pattern: "0 11 1 * *", // 11 AM on 1st of every month
            tz: "Asia/Kolkata",
          },
          jobId: "monthly-report-cron",
        },
      );

      console.log("Repeatable jobs setup completed");
    } catch (error) {
      console.error("Error setting up repeatable jobs:", error);
    }
  }

  private async processJob(job: Job<ReportsJobData>): Promise<any> {
    const { type, reportType, payload } = job.data;

    console.log(`Processing job ${job.id} of type: ${type}`);

    try {
      switch (type) {
        case "report-generation":
          return await this.generateReport(reportType, payload);
        default:
          throw new Error(`Unknown job type: ${type}`);
      }
    } catch (error) {
      console.error(`Error processing job ${job.id}:`, error);
      throw error;
    }
  }

  private async generateReport(
    reportType: string,
    payload?: any,
  ): Promise<any> {
    // Simulate report generation
    console.log(`Generating ${reportType} report...`);

    // Add actual report generation logic here
    await new Promise((resolve) => setTimeout(resolve, 2000)); // Simulate work

    const result = {
      reportType,
      generatedAt: new Date().toISOString(),
      status: "completed",
      data: payload || {},
    };

    console.log(`${reportType} report generated successfully`);
    return result;
  }

  async addJob(
    name: string,
    data: ReportsJobData,
    options?: any,
  ): Promise<Job> {
    return this.queue.add(name, data, options);
  }

  async runReportNow(reportType: string, payload?: any): Promise<Job> {
    return this.addJob(
      `manual-${reportType}-report`,
      {
        type: "report-generation",
        reportType,
        payload,
        timestamp: Date.now(),
      },
      {
        priority: 1, // High priority for manual runs
      },
    );
  }

  async getQueueHealth(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: boolean;
  }> {
    const waiting = await this.queue.getWaiting();
    const active = await this.queue.getActive();
    const completed = await this.queue.getCompleted();
    const failed = await this.queue.getFailed();
    const delayed = await this.queue.getDelayed();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
      paused: await this.queue.isPaused(),
    };
  }

  async getRecentJobs(limit = 10): Promise<Job[]> {
    return this.queue.getJobs(
      ["completed", "failed", "active", "waiting"],
      0,
      limit - 1,
    );
  }

  getQueue(): Queue {
    return this.queue;
  }

  async gracefulShutdown(): Promise<void> {
    if (this.isShuttingDown) return;

    this.isShuttingDown = true;
    console.log("Shutting down queue service...");

    try {
      // Close worker gracefully
      await this.worker.close();
      console.log("Worker closed");

      // Close queue events
      await this.queueEvents.close();
      console.log("Queue events closed");

      // Close queue
      await this.queue.close();
      console.log("Queue closed");

      console.log("Queue service shutdown completed");
    } catch (error) {
      console.error("Error during queue service shutdown:", error);
    }
  }
}

// Singleton instance
let queueServiceInstance: QueueService | null = null;

export function getQueueService(): QueueService {
  if (!queueServiceInstance) {
    queueServiceInstance = new QueueService();
  }
  return queueServiceInstance;
}

export async function shutdownQueueService(): Promise<void> {
  if (queueServiceInstance) {
    await queueServiceInstance.gracefulShutdown();
    queueServiceInstance = null;
  }
}
