import { Queue } from "bullmq";

import type { RedisConnection } from "./redis.js";

export function createQueue<DataType>(name: string, connection: RedisConnection): Queue<DataType> {
  return new Queue<DataType>(name, {
    connection,
    defaultJobOptions: {
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 10_000
      },
      removeOnComplete: {
        age: 24 * 60 * 60,
        count: 1_000
      },
      removeOnFail: {
        age: 7 * 24 * 60 * 60,
        count: 5_000
      }
    }
  });
}
