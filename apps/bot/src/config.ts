import { getOptionalNumber, getOptionalString, getRequiredString } from "./lib/env.js";

export type BotTransport = "auto" | "polling" | "webhook";

export interface BotConfig {
  botToken: string;
  botUsername: string;
  transport: BotTransport;
  publicBaseUrl?: string;
  webhookPath: string;
  webhookSecret?: string;
  httpPort: number;
  internalApiToken: string;
  timezone: string;
  miniAppShortName?: string;
  defaultChildName?: string;
}

export function loadBotConfig(env: NodeJS.ProcessEnv = process.env): BotConfig {
  const transport = (getOptionalString(env, "BOT_TRANSPORT") ?? "auto") as BotTransport;

  if (!["auto", "polling", "webhook"].includes(transport)) {
    throw new Error(`Unsupported BOT_TRANSPORT value: ${transport}`);
  }

  return {
    botToken: getRequiredString(env, "BOT_TOKEN"),
    botUsername: getRequiredString(env, "BOT_USERNAME"),
    transport,
    publicBaseUrl: trimTrailingSlash(getOptionalString(env, "BOT_PUBLIC_BASE_URL")),
    webhookPath: getOptionalString(env, "BOT_WEBHOOK_PATH") ?? "/telegram/webhook",
    webhookSecret: getOptionalString(env, "BOT_WEBHOOK_SECRET"),
    httpPort: getOptionalNumber(env, "BOT_HTTP_PORT") ?? 3021,
    internalApiToken: getRequiredString(env, "BOT_INTERNAL_API_TOKEN"),
    timezone: getOptionalString(env, "BOT_TIMEZONE") ?? "Europe/Moscow",
    miniAppShortName: getOptionalString(env, "BOT_MINI_APP_SHORT_NAME"),
    defaultChildName: getOptionalString(env, "BOT_DEFAULT_CHILD_NAME")
  };
}

export function resolveTransport(config: BotConfig): Exclude<BotTransport, "auto"> {
  if (config.transport === "auto") {
    return config.publicBaseUrl ? "webhook" : "polling";
  }

  if (config.transport === "webhook" && !config.publicBaseUrl) {
    throw new Error("BOT_PUBLIC_BASE_URL is required when BOT_TRANSPORT=webhook");
  }

  return config.transport;
}

function trimTrailingSlash(value?: string): string | undefined {
  return value?.replace(/\/+$/, "");
}
