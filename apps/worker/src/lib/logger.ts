export type LogLevel = "debug" | "info" | "warn" | "error";

export class Logger {
  public constructor(private readonly bindings: Record<string, unknown> = {}) {}

  public child(bindings: Record<string, unknown>): Logger {
    return new Logger({
      ...this.bindings,
      ...bindings
    });
  }

  public debug(message: string, context: Record<string, unknown> = {}): void {
    this.write("debug", message, context);
  }

  public info(message: string, context: Record<string, unknown> = {}): void {
    this.write("info", message, context);
  }

  public warn(message: string, context: Record<string, unknown> = {}): void {
    this.write("warn", message, context);
  }

  public error(message: string, context: Record<string, unknown> = {}): void {
    this.write("error", message, context);
  }

  private write(level: LogLevel, message: string, context: Record<string, unknown>): void {
    const payload = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.bindings,
      ...context
    };

    const line = JSON.stringify(payload);

    if (level === "error") {
      console.error(line);
      return;
    }

    console.log(line);
  }
}
