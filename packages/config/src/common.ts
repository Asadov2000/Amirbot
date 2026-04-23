import { z } from "zod";

export const nodeEnvironments = ["development", "test", "production"] as const;
export const appEnvironments = ["local", "development", "staging", "production"] as const;
export const logLevels = ["fatal", "error", "warn", "info", "debug", "trace"] as const;

export const nodeEnvSchema = z.enum(nodeEnvironments).default("development");
export const appEnvSchema = z.enum(appEnvironments).default("local");
export const logLevelSchema = z.enum(logLevels).default("info");

export const nonEmptyStringSchema = z.string().trim().min(1);
export const urlSchema = z.string().trim().url();
export const postgresUrlSchema = z.string().trim().url().refine((value) => value.startsWith("postgres://") || value.startsWith("postgresql://"), {
  message: "Ожидается строка подключения PostgreSQL"
});
export const redisUrlSchema = z
  .string()
  .trim()
  .url()
  .refine((value) => value.startsWith("redis://") || value.startsWith("rediss://"), {
    message: "Ожидается строка подключения Redis"
  });

export const timeZoneSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => {
    try {
      Intl.DateTimeFormat("ru-RU", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Ожидается корректная IANA timezone");

export const envBooleanSchema = z.preprocess((value) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (["1", "true", "yes", "on"].includes(normalized)) {
      return true;
    }

    if (["0", "false", "no", "off"].includes(normalized)) {
      return false;
    }
  }

  return value;
}, z.boolean());

export const envIntegerSchema = z.coerce.number().int();

export const baseServerEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  APP_ENV: appEnvSchema,
  LOG_LEVEL: logLevelSchema,
  TZ: timeZoneSchema.default("Europe/Moscow")
});

export function parseEnv<TShape extends z.ZodRawShape>(
  schema: z.ZodObject<TShape>,
  rawEnv: NodeJS.ProcessEnv = process.env
) {
  const selected = Object.fromEntries(
    Object.keys(schema.shape).map((key) => [key, rawEnv[key]])
  );

  return schema.parse(selected);
}
