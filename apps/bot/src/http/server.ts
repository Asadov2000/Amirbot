import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

import type { Bot, Context } from "grammy";

import type { BotConfig } from "../config.js";
import type { ReminderDispatchRequest } from "../domain/types.js";
import type { Logger } from "../lib/logger.js";
import { ReminderDeliveryService } from "../services/reminder-delivery.service.js";

export interface BotHttpServerDependencies {
  bot: Bot<Context>;
  config: BotConfig;
  reminderDeliveryService: ReminderDeliveryService;
  logger: Logger;
}

export class BotHttpServer {
  private readonly server: Server;

  public constructor(private readonly dependencies: BotHttpServerDependencies) {
    this.server = createServer((request, response) => {
      void this.handleRequest(request, response);
    });
  }

  public async start(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(this.dependencies.config.httpPort, () => {
        this.server.off("error", reject);
        resolve();
      });
    });

    this.dependencies.logger.info("Bot HTTP server started", {
      port: this.dependencies.config.httpPort
    });
  }

  public async stop(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  private async handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    try {
      if (request.method === "GET" && request.url === "/healthz") {
        sendJson(response, 200, { status: "ok" });
        return;
      }

      if (request.method === "POST" && request.url === "/internal/reminders") {
        await this.handleInternalReminderRequest(request, response);
        return;
      }

      if (request.method === "POST" && request.url === this.dependencies.config.webhookPath) {
        await this.handleWebhookRequest(request, response);
        return;
      }

      sendJson(response, 404, { error: "Not Found" });
    } catch (error) {
      this.dependencies.logger.error("Bot HTTP request failed", {
        method: request.method,
        url: request.url,
        error: getErrorMessage(error)
      });

      sendJson(response, 500, { error: "Internal Server Error" });
    }
  }

  private async handleInternalReminderRequest(
    request: IncomingMessage,
    response: ServerResponse
  ): Promise<void> {
    if (!isAuthorizedInternalRequest(request, this.dependencies.config.internalApiToken)) {
      sendJson(response, 401, { error: "Unauthorized" });
      return;
    }

    const payload = await readJsonBody<ReminderDispatchRequest>(request);

    validateReminderPayload(payload);

    await this.dependencies.reminderDeliveryService.send(payload);
    sendJson(response, 202, {
      accepted: true,
      reminderId: payload.reminderId
    });
  }

  private async handleWebhookRequest(
    request: IncomingMessage,
    response: ServerResponse
  ): Promise<void> {
    if (this.dependencies.config.webhookSecret) {
      const providedSecret = request.headers["x-telegram-bot-api-secret-token"];

      if (providedSecret !== this.dependencies.config.webhookSecret) {
        sendJson(response, 401, { error: "Invalid webhook secret" });
        return;
      }
    }

    const update = (await readJsonBody<unknown>(request)) as Parameters<
      typeof this.dependencies.bot.handleUpdate
    >[0];

    await this.dependencies.bot.handleUpdate(update);
    sendJson(response, 200, { ok: true });
  }
}

function isAuthorizedInternalRequest(request: IncomingMessage, token: string): boolean {
  const authorizationHeader = request.headers.authorization;
  return authorizationHeader === `Bearer ${token}`;
}

async function readJsonBody<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const rawBody = Buffer.concat(chunks).toString("utf8");

  if (!rawBody) {
    return {} as T;
  }

  return JSON.parse(rawBody) as T;
}

function validateReminderPayload(payload: ReminderDispatchRequest): void {
  if (
    !payload.reminderId ||
    !payload.familyId ||
    !payload.chatId ||
    !payload.title ||
    !payload.body ||
    !payload.dueAt
  ) {
    throw new Error(
      "Reminder payload must include reminderId, familyId, chatId, title, body and dueAt"
    );
  }
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
