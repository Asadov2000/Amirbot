import { createServer, type Server } from "node:http";

import type { Logger } from "../lib/logger.js";

export class HealthServer {
  private readonly server: Server;

  public constructor(
    private readonly port: number,
    private readonly logger: Logger
  ) {
    this.server = createServer((request, response) => {
      if (request.method === "GET" && request.url === "/healthz") {
        response.statusCode = 200;
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        response.end(JSON.stringify({ status: "ok" }));
        return;
      }

      response.statusCode = 404;
      response.end();
    });
  }

  public async start(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(this.port, () => {
        this.server.off("error", reject);
        resolve();
      });
    });

    this.logger.info("Worker health server started", { port: this.port });
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
}
