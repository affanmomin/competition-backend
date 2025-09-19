import 'dotenv/config';
import { z } from 'zod';

const Env = z.object({
  REDIS_HOST: z.string().default('127.0.0.1'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  QUEUE_PREFIX: z.string().default('myapp:dev'),
  CRON_TZ: z.string().default('Asia/Kolkata'),
});

export const env = Env.parse(process.env);


