import type { ConnectionOptions } from 'bullmq';
import { env } from '../config/env';

export const connection: ConnectionOptions = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD,
};

export const prefix = `{${env.QUEUE_PREFIX}}`;


