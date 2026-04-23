import { z } from "zod";

import {
  baseServerEnvSchema,
  envBooleanSchema,
  parseEnv,
  postgresUrlSchema,
  redisUrlSchema
} from "./common.js";

export const prismaLogLevels = ["info", "query", "warn", "error"] as const;

export const dbEnvSchema = baseServerEnvSchema.extend({
  DATABASE_URL: postgresUrlSchema,
  DIRECT_URL: postgresUrlSchema.optional(),
  SHADOW_DATABASE_URL: postgresUrlSchema.optional(),
  REDIS_URL: redisUrlSchema.optional(),
  PRISMA_QUERY_LOG: envBooleanSchema.default(false),
  PRISMA_LOG_LEVEL: z.enum(prismaLogLevels).default("warn")
});

export type DbEnv = z.output<typeof dbEnvSchema>;

export function parseDbEnv(rawEnv: NodeJS.ProcessEnv = process.env): DbEnv {
  return parseEnv(dbEnvSchema, rawEnv);
}
