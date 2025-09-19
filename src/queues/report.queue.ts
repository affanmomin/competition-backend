import { Queue } from 'bullmq';
import { connection, prefix } from '../lib/redis';

export const reportQueue = new Queue('report-queue', { connection, prefix });


