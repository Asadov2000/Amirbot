import { Redis } from "ioredis";

export type RedisConnection = Redis;

export function createRedisConnection(redisUrl: string, connectionName: string): RedisConnection {
  return new Redis(redisUrl, {
    connectionName,
    maxRetriesPerRequest: null,
    enableReadyCheck: true
  });
}

export async function closeRedisConnection(connection: RedisConnection): Promise<void> {
  try {
    await connection.quit();
  } catch {
    connection.disconnect();
  }
}
