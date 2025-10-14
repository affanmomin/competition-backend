/**
 * Bull Board UI service for monitoring queues
 */

import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { FastifyAdapter } from "@bull-board/fastify";
import { FastifyInstance } from "fastify";
import { getQueueService } from "./queue-service";

export class BullBoardService {
  private serverAdapter: FastifyAdapter;
  private bullBoard: ReturnType<typeof createBullBoard>;

  constructor() {
    this.serverAdapter = new FastifyAdapter();
    this.serverAdapter.setBasePath("/admin/queues");

    // Get the queue from the queue service
    const queueService = getQueueService();
    const queue = queueService.getQueue();

    // Create the bull board
    this.bullBoard = createBullBoard({
      queues: [new BullMQAdapter(queue)],
      serverAdapter: this.serverAdapter,
    });
  }

  async registerWithFastify(fastify: FastifyInstance): Promise<void> {
    // Register the plugin using the new API
    await fastify.register(this.serverAdapter.registerPlugin(), {
      prefix: "/admin/queues",
    });

    fastify.log.info("Bull Board UI registered at /admin/queues");
  }

  getServerAdapter(): FastifyAdapter {
    return this.serverAdapter;
  }

  getBullBoard(): ReturnType<typeof createBullBoard> {
    return this.bullBoard;
  }

  addQueue(queueName: string, queue: any): void {
    this.bullBoard.addQueue(new BullMQAdapter(queue, { readOnlyMode: false }));
  }

  removeQueue(queueName: string): void {
    this.bullBoard.removeQueue(queueName);
  }
}

// Singleton instance
let bullBoardServiceInstance: BullBoardService | null = null;

export function getBullBoardService(): BullBoardService {
  if (!bullBoardServiceInstance) {
    bullBoardServiceInstance = new BullBoardService();
  }
  return bullBoardServiceInstance;
}

export function resetBullBoardService(): void {
  bullBoardServiceInstance = null;
}
