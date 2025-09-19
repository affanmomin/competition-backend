import fastify from 'fastify';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { createBullBoard } from '@bull-board/api';
import { FastifyAdapter } from '@bull-board/fastify';
import { reportQueue } from './queues/report.queue';

export async function registerAdmin(app: ReturnType<typeof fastify>) {
  const serverAdapter = new FastifyAdapter();
  serverAdapter.setBasePath('/admin');
  createBullBoard({ queues: [new BullMQAdapter(reportQueue)], serverAdapter });
  await app.register(serverAdapter.registerPlugin(), { prefix: '/admin' });
}


