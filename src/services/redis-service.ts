/**
 * Redis service for managing Redis connections
 */

import Redis from "ioredis";

let redisClient: Redis | null = null;

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  maxRetriesPerRequest?: number | null;
  retryDelayOnFailover?: number;
  lazyConnect?: boolean;
}

export function createRedisConnection(config?: Partial<RedisConfig>): Redis {
  const defaultConfig: RedisConfig = {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || "0"),
    maxRetriesPerRequest: null, // Required by BullMQ
    retryDelayOnFailover: 100,
    lazyConnect: true,
  };

  const finalConfig = { ...defaultConfig, ...config };

  const redis = new Redis({
    host: finalConfig.host,
    port: finalConfig.port,
    password: finalConfig.password,
    db: finalConfig.db,
    maxRetriesPerRequest: finalConfig.maxRetriesPerRequest,
    lazyConnect: finalConfig.lazyConnect,
  });

  redis.on("connect", () => {
    console.log(`Redis connected to ${finalConfig.host}:${finalConfig.port}`);
  });

  redis.on("error", (error: any) => {
    console.error("Redis connection error:", error);
  });

  redis.on("close", () => {
    console.log("Redis connection closed");
  });

  return redis;
}

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = createRedisConnection();
  }
  return redisClient;
}

export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

export async function testRedisConnection(): Promise<boolean> {
  try {
    const redis = getRedisClient();
    const result = await redis.ping();
    return result === "PONG";
  } catch (error) {
    console.error("Redis health check failed:", error);
    return false;
  }
}
