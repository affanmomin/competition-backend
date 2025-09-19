import { reportQueue } from '../queues/report.queue';
import { env } from '../config/env';

async function seed() {
  await reportQueue.add(
    'daily-report',
    { days: 1 },
    {
      repeat: { cron: '5 0 * * *', tz: env.CRON_TZ },
      jobId: 'daily-report@00:05-IST',
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: 100,
      removeOnFail: 100,
    }
  );
  console.log('Seeded repeatable "daily-report" at 00:05', env.CRON_TZ);
}

seed()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });


