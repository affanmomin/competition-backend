import { Worker } from 'bullmq';
import { connection, prefix } from '../lib/redis';

type JobData = { days: number };

const worker = new Worker<JobData>(
  'report-queue',
  async (job) => {
    console.log(`[Worker] ${job.name} id=${job.id}`, job.data);
    // Implement your idempotent task here
  },
  { connection, prefix, concurrency: 5 }
);

worker.on('completed', (job) => console.log(`[Worker] completed id=${job.id}`));
worker.on('failed', (job, err) => console.error(`[Worker] failed id=${job?.id} reason=${(err as Error)?.message}`));

const shutdown = async () => {
  await worker.close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);


