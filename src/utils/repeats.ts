import { reportQueue } from '../queues/report.queue';

async function list() {
  const reps = await reportQueue.getRepeatableJobs();
  console.table(
    reps.map((r) => ({
      key: r.key,
      name: r.name,
      cron: r.cron,
      tz: (r as any).tz,
      next: new Date(r.next).toISOString(),
    })),
  );
}

async function clearAll() {
  const reps = await reportQueue.getRepeatableJobs();
  for (const r of reps) {
    await reportQueue.removeRepeatableByKey(r.key);
    console.log('Removed', r.key);
  }
}

const cmd = process.argv[2];
if (cmd === 'list') list().then(() => process.exit(0));
else if (cmd === 'clear') clearAll().then(() => process.exit(0));
else {
  console.log('Usage: repeats [list|clear]');
  process.exit(1);
}


