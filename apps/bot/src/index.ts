import { startBotApplication } from "./app.js";

const app = await startBotApplication();

const shutdown = async (signal: string): Promise<void> => {
  try {
    await app.stop();
    process.exit(0);
  } catch (error) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "error",
        message: "Failed to shutdown bot application",
        signal,
        error: error instanceof Error ? error.message : String(error)
      })
    );
    process.exit(1);
  }
};

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});

process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});
