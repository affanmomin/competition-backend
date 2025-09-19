import Fastify from 'fastify';
import autoLoad from '@fastify/autoload';
import path from 'node:path';
import { registerAdmin } from './admin';
import { reportQueue } from './queues/report.queue';

const server = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  },
});

// Register CORS
server.register(require('@fastify/cors'), {
  origin: true,
  credentials: true
});

server.register(autoLoad, {
  dir: path.join(__dirname, 'routes'),
});

// Basic health route if missing
server.get('/health', async () => ({ status: 'ok' }));

// Manual trigger route for daily-report
server.post('/jobs/daily-report/run-now', async () => {
  await reportQueue.add('daily-report-manual', { days: 1 }, { removeOnComplete: true });
  return { ok: true };
});

// Register bull-board admin after other routes
server.after(async () => {
  await registerAdmin(server);
});

export default server;
